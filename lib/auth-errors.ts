export class AuthRequiredError extends Error {
  constructor(message = 'Authentication required') {
    super(message);
    this.name = 'AuthRequiredError';
  }
}

export class NetworkAuthError extends Error {
  constructor(message = 'Authentication service unavailable. Please try again.') {
    super(message);
    this.name = 'NetworkAuthError';
  }
}

export class ForbiddenError extends Error {
  constructor(message = 'Access denied. Valid role required.') {
    super(message);
    this.name = 'ForbiddenError';
  }
}


