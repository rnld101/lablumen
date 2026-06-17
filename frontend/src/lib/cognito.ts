// Cognito authentication via amazon-cognito-identity-js (SRP / USER_PASSWORD_AUTH).
// The app client is a public client (no secret); we store the ID token (carries email +
// cognito:groups) and attach it as a Bearer token on API calls.
import {
  AuthenticationDetails,
  CognitoUser,
  CognitoUserPool,
} from "amazon-cognito-identity-js";

const userPool = new CognitoUserPool({
  UserPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID ?? "",
  ClientId: import.meta.env.VITE_COGNITO_APP_CLIENT_ID ?? "",
});

export interface SignInResult {
  idToken: string;
  email?: string;
  groups: string[];
}

export function signIn(email: string, password: string): Promise<SignInResult> {
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: email, Pool: userPool });
    const details = new AuthenticationDetails({ Username: email, Password: password });
    user.authenticateUser(details, {
      onSuccess: (session) => {
        const idToken = session.getIdToken().getJwtToken();
        const payload = session.getIdToken().decodePayload();
        resolve({
          idToken,
          email: payload.email as string | undefined,
          groups: (payload["cognito:groups"] as string[] | undefined) ?? [],
        });
      },
      onFailure: (err) => reject(err),
      newPasswordRequired: () =>
        reject(new Error("A password reset is required. Please contact an administrator.")),
    });
  });
}

export function signOutCognito(email: string): void {
  const user = new CognitoUser({ Username: email, Pool: userPool });
  user.signOut();
}
