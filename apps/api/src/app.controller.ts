import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  getRoot() {
    return {
      name: 'Raffle Royale API',
      status: 'ok',
    };
  }
}
