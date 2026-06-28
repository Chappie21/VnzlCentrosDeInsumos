import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { RateLimitGuard } from "../guards";
import { AuthService } from "./auth.service";
import { RegisterDto, LoginDto, GoogleDto } from "./dto";

@Controller("auth")
export class AuthController {
  constructor(private readonly service: AuthService) {}

  @UseGuards(RateLimitGuard)
  @Post("register")
  register(@Body() dto: RegisterDto) { return this.service.register(dto); }

  @UseGuards(RateLimitGuard)
  @Post("login")
  login(@Body() dto: LoginDto) { return this.service.login(dto); }

  @UseGuards(RateLimitGuard)
  @Post("google")
  google(@Body() dto: GoogleDto) { return this.service.google(dto.idToken); }
}
