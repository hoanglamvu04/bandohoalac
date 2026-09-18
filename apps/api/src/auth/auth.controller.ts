import { Body, Controller, Post } from '@nestjs/common';

@Controller('auth')
export class AuthController {
  @Post('register')
  register(@Body() body: unknown) {
    return {
      message: 'Registration endpoint foundation',
      data: body,
    };
  }

  @Post('login')
  login(@Body() body: unknown) {
    return {
      message: 'Login endpoint foundation',
      data: body,
    };
  }
}
