import { Controller, Get, Param, Query } from '@nestjs/common';

@Controller('places')
export class PlacesController {
  @Get()
  findAll(@Query() query: Record<string, unknown>) {
    return { items: [], query };
  }

  @Get(':slug')
  findOne(@Param('slug') slug: string) {
    return { slug };
  }

  @Get('nearby')
  nearby(@Query() query: Record<string, unknown>) {
    return { items: [], query };
  }
}
