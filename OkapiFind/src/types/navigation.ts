export type RootStackParamList = {
  Map: undefined;
  Guidance: {
    userLocation: {
      latitude: number;
      longitude: number;
    };
    carLocation: {
      latitude: number;
      longitude: number;
    };
  };
  Settings: undefined;
  Legal: {
    document: 'privacy' | 'terms';
  };
  Paywall: undefined;
  SignIn: undefined;
};