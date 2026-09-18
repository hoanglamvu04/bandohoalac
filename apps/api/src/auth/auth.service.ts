import { Injectable } from '@nestjs/common';

@Injectable()
export class AuthService {
  async validateUser(email: string, password: string) {
    return {
      email,
      passwordProvided: Boolean(password),
    };
  }

  async createSession(userId: string) {
    return {
      userId,
      accessToken: null,
      refreshToken: null,
    };
  }
}
