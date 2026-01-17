// Type declarations for firebase/firestore v12
// These supplement the default exports for TypeScript compatibility

declare module 'firebase/firestore' {
  import { FirebaseApp } from 'firebase/app';

  export interface Firestore {
    app: FirebaseApp;
    type: string;
  }

  export interface DocumentReference<T = any> {
    id: string;
    path: string;
    parent: CollectionReference<T>;
    firestore: Firestore;
  }

  export interface DocumentSnapshot<T = any> {
    id: string;
    ref: DocumentReference<T>;
    exists(): boolean;
    data(): T | undefined;
    get(fieldPath: string): any;
  }

  export interface CollectionReference<T = any> {
    id: string;
    path: string;
    parent: DocumentReference | null;
    firestore: Firestore;
  }

  export interface Query<T = any> {
    firestore: Firestore;
  }

  export interface QuerySnapshot<T = any> {
    docs: QueryDocumentSnapshot<T>[];
    size: number;
    empty: boolean;
    forEach(callback: (doc: QueryDocumentSnapshot<T>) => void): void;
  }

  export interface QueryDocumentSnapshot<T = any> extends DocumentSnapshot<T> {
    data(): T;
  }

  export interface FieldValue {
    isEqual(other: FieldValue): boolean;
  }

  export interface Timestamp {
    seconds: number;
    nanoseconds: number;
    toDate(): Date;
    toMillis(): number;
  }

  export const Timestamp: {
    now(): Timestamp;
    fromDate(date: Date): Timestamp;
    fromMillis(milliseconds: number): Timestamp;
  };

  export interface QueryConstraint {
    type: string;
  }

  export function getFirestore(app?: FirebaseApp): Firestore;
  export function doc(firestore: Firestore, path: string, ...pathSegments: string[]): DocumentReference;
  export function doc(reference: CollectionReference, path?: string, ...pathSegments: string[]): DocumentReference;
  export function collection(firestore: Firestore, path: string, ...pathSegments: string[]): CollectionReference;
  export function getDoc<T>(reference: DocumentReference<T>): Promise<DocumentSnapshot<T>>;
  export function getDocs<T>(query: Query<T>): Promise<QuerySnapshot<T>>;
  export function setDoc<T>(reference: DocumentReference<T>, data: T, options?: any): Promise<void>;
  export function updateDoc<T>(reference: DocumentReference<T>, data: Partial<T>): Promise<void>;
  export function deleteDoc(reference: DocumentReference): Promise<void>;
  export function addDoc<T>(reference: CollectionReference<T>, data: T): Promise<DocumentReference<T>>;
  export function query<T>(query: Query<T>, ...queryConstraints: QueryConstraint[]): Query<T>;
  export function where(fieldPath: string, opStr: string, value: any): QueryConstraint;
  export function orderBy(fieldPath: string, directionStr?: 'asc' | 'desc'): QueryConstraint;
  export function limit(limit: number): QueryConstraint;
  export function serverTimestamp(): FieldValue;
  export function increment(n: number): FieldValue;
  export function arrayUnion(...elements: any[]): FieldValue;
  export function arrayRemove(...elements: any[]): FieldValue;
}
