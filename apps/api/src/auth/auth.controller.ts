import { Body, Controller, Post } from '@nestjs/common';
import { Public } from './public.decorator';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RequestTokenDto } from './dto/request-token.dto';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @Public()
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto.email, loginDto.password);
  }

  @Post('refresh')
  @Public()
  refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refresh(refreshTokenDto.refreshToken);
  }

  @Post('token')
  @Public()
  issueToken(@Body() requestTokenDto: RequestTokenDto) {
    return this.authService.issueToken(
      requestTokenDto.userId,
      requestTokenDto.role,
    );
  }
}
