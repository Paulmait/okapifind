// @ts-nocheck
/**
 * Customer Support Ticketing System
 * CRITICAL: Manage user support requests at scale
 * Integrates with email, in-app chat, and support platforms
 */

import { supabase } from '../lib/supabase-client';
import { analytics } from './analytics';

export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TicketCategory =
  | 'bug_report'
  | 'feature_request'
  | 'billing'
  | 'account'
  | 'technical'
  | 'other';

export interface SupportTicket {
  id: string;
  user_id: string;
  email: string;
  subject: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  attachments?: string[];
  device_info?: {
    platform: string;
    version: string;
    model: string;
  };
  created_at: string;
  updated_at: string;
  resolved_at?: string;
  assigned_to?: string;
}

export interface TicketMessage {
  id: string;
  ticket_id: string;
  sender_id: string;
  sender_type: 'user' | 'support';
  message: string;
  created_at: string;
}

export interface TicketStats {
  total: number;
  open: number;
  in_progress: number;
  resolved: number;
  avgResolutionTime: number; // in hours
  satisfactionScore: number;
}

class SupportTicketService {
  /**
   * Create new support ticket
   */
  async createTicket(ticket: Omit<SupportTicket, 'id' | 'created_at' | 'updated_at' | 'status'>): Promise<SupportTicket> {
    try {
      // Auto-assign priority based on category
      const priority = this.calculatePriority(ticket.category);

      const { data, error } = await supabase
        .from('support_tickets')
        .insert([{
          ...ticket,
          priority,
          status: 'open',
        }])
        .select()
        .single();

      if (error) throw error;

      // Send confirmation email
      await this.sendTicketConfirmationEmail(data);

      // Track analytics
      analytics.logEvent('support_ticket_created', {
        category: ticket.category,
        priority,
      });

      // Send notification to support team
      await this.notifySupportTeam(data);

      return data;
    } catch (error) {
      console.error('Error creating support ticket:', error);
      throw error;
    }
  }

  /**
   * Get ticket by ID
   */
  async getTicket(ticketId: string): Promise<SupportTicket | null> {
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('id', ticketId)
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error fetching ticket:', error);
      return null;
    }
  }

  /**
   * Get all tickets for user
   */
  async getUserTickets(userId: string): Promise<SupportTicket[]> {
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error fetching user tickets:', error);
      return [];
    }
  }

  /**
   * Update ticket status
   */
  async updateTicketStatus(
    ticketId: string,
    status: TicketStatus
  ): Promise<void> {
    try {
      const updates: any = {
        status,
        updated_at: new Date().toISOString(),
      };

      if (status === 'resolved' || status === 'closed') {
        updates.resolved_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('support_tickets')
        .update(updates)
        .eq('id', ticketId);

      if (error) throw error;

      // Send status update email
      const ticket = await this.getTicket(ticketId);
      if (ticket) {
        await this.sendStatusUpdateEmail(ticket);
      }

      analytics.logEvent('support_ticket_status_updated', {
        ticket_id: ticketId,
        new_status: status,
      });
    } catch (error) {
      console.error('Error updating ticket status:', error);
      throw error;
    }
  }

  /**
   * Add message to ticket
   */
  async addMessage(
    ticketId: string,
    senderId: string,
    senderType: 'user' | 'support',
    message: string
  ): Promise<TicketMessage> {
    try {
      const { data, error } = await supabase
        .from('ticket_messages')
        .insert([{
          ticket_id: ticketId,
          sender_id: senderId,
          sender_type: senderType,
          message,
        }])
        .select()
        .single();

      if (error) throw error;

      // Update ticket's updated_at timestamp
      await supabase
        .from('support_tickets')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', ticketId);

      // Send notification
      if (senderType === 'support') {
        await this.notifyUserOfResponse(ticketId);
      } else {
        await this.notifySupportOfUserMessage(ticketId);
      }

      analytics.logEvent('support_message_added', {
        ticket_id: ticketId,
        sender_type: senderType,
      });

      return data;
    } catch (error) {
      console.error('Error adding message:', error);
      throw error;
    }
  }

  /**
   * Get messages for ticket
   */
  async getTicketMessages(ticketId: string): Promise<TicketMessage[]> {
    try {
      const { data, error } = await supabase
        .from('ticket_messages')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error fetching ticket messages:', error);
      return [];
    }
  }

  /**
   * Get support statistics
   */
  async getStats(userId?: string): Promise<TicketStats> {
    try {
      let query = supabase.from('support_tickets').select('*');

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query;

      if (error) throw error;

      const tickets = data || [];

      // Calculate statistics
      const total = tickets.length;
      const open = tickets.filter(t => t.status === 'open').length;
      const in_progress = tickets.filter(t => t.status === 'in_progress').length;
      const resolved = tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length;

      // Calculate average resolution time
      const resolvedTickets = tickets.filter(t => t.resolved_at);
      let avgResolutionTime = 0;

      if (resolvedTickets.length > 0) {
        const totalTime = resolvedTickets.reduce((sum, ticket) => {
          const created = new Date(ticket.created_at).getTime();
          const resolved = new Date(ticket.resolved_at!).getTime();
          return sum + (resolved - created);
        }, 0);

        avgResolutionTime = totalTime / resolvedTickets.length / (1000 * 60 * 60); // hours
      }

      return {
        total,
        open,
        in_progress,
        resolved,
        avgResolutionTime,
        satisfactionScore: 0, // TODO: Implement satisfaction surveys
      };
    } catch (error) {
      console.error('Error fetching support stats:', error);
      return {
        total: 0,
        open: 0,
        in_progress: 0,
        resolved: 0,
        avgResolutionTime: 0,
        satisfactionScore: 0,
      };
    }
  }

  /**
   * Search tickets
   */
  async searchTickets(query: string, filters?: {
    status?: TicketStatus;
    category?: TicketCategory;
    priority?: TicketPriority;
  }): Promise<SupportTicket[]> {
    try {
      let supabaseQuery = supabase
        .from('support_tickets')
        .select('*')
        .or(`subject.ilike.%${query}%,description.ilike.%${query}%`);

      if (filters?.status) {
        supabaseQuery = supabaseQuery.eq('status', filters.status);
      }

      if (filters?.category) {
        supabaseQuery = supabaseQuery.eq('category', filters.category);
      }

      if (filters?.priority) {
        supabaseQuery = supabaseQuery.eq('priority', filters.priority);
      }

      const { data, error } = await supabaseQuery;

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error searching tickets:', error);
      return [];
    }
  }

  /**
   * Calculate priority based on category
   */
  private calculatePriority(category: TicketCategory): TicketPriority {
    const priorityMap: Record<TicketCategory, TicketPriority> = {
      bug_report: 'high',
      billing: 'urgent',
      account: 'high',
      technical: 'medium',
      feature_request: 'low',
      other: 'medium',
    };

    return priorityMap[category];
  }

  /**
   * Send ticket confirmation email
   */
  private async sendTicketConfirmationEmail(ticket: SupportTicket): Promise<void> {
    // TODO: Integrate with Resend
    console.log('Sending ticket confirmation email to:', ticket.email);
  }

  /**
   * Send status update email
   */
  private async sendStatusUpdateEmail(ticket: SupportTicket): Promise<void> {
    // TODO: Integrate with Resend
    console.log('Sending status update email to:', ticket.email);
  }

  /**
   * Notify support team of new ticket
   */
  private async notifySupportTeam(ticket: SupportTicket): Promise<void> {
    // TODO: Send Slack notification or email to support team
    console.log('Notifying support team of new ticket:', ticket.id);
  }

  /**
   * Notify user of support response
   */
  private async notifyUserOfResponse(ticketId: string): Promise<void> {
    // TODO: Send push notification and email
    console.log('Notifying user of support response:', ticketId);
  }

  /**
   * Notify support team of user message
   */
  private async notifySupportOfUserMessage(ticketId: string): Promise<void> {
    // TODO: Send notification to support team
    console.log('Notifying support team of user message:', ticketId);
  }

  /**
   * Upload attachment
   */
  async uploadAttachment(
    ticketId: string,
    file: Blob,
    filename: string
  ): Promise<string> {
    try {
      const path = `support/${ticketId}/${Date.now()}_${filename}`;

      const { error } = await supabase.storage
        .from('support-attachments')
        .upload(path, file);

      if (error) throw error;

      const { data } = supabase.storage
        .from('support-attachments')
        .getPublicUrl(path);

      return data.publicUrl;
    } catch (error) {
      console.error('Error uploading attachment:', error);
      throw error;
    }
  }

  /**
   * Close ticket
   */
  async closeTicket(ticketId: string): Promise<void> {
    await this.updateTicketStatus(ticketId, 'closed');
  }

  /**
   * Reopen ticket
   */
  async reopenTicket(ticketId: string): Promise<void> {
    await this.updateTicketStatus(ticketId, 'open');
  }
}

// Export singleton instance
export const supportTicketService = new SupportTicketService();

export default supportTicketService;