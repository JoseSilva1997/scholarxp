import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { UserPasswordService } from './user-password.service';
import { CreateUserPasswordDto } from './dto/create-user-password.dto';
import { UpdateUserPasswordDto } from './dto/update-user-password.dto';

@Controller('user-password')
export class UserPasswordController {
  constructor(private readonly userPasswordService: UserPasswordService) {}

  @Post()
  create(@Body() createUserPasswordDto: CreateUserPasswordDto) {
    return this.userPasswordService.create(createUserPasswordDto);
  }

  @Get()
  findAll() {
    return this.userPasswordService.findAll();
  }

  @Get(':userId')
  findOne(@Param('userId') userId: string) {
    return this.userPasswordService.findOne(+userId);
  }

  @Patch(':userId')
  update(@Param('userId') userId: string, @Body() updateUserPasswordDto: UpdateUserPasswordDto) {
    return this.userPasswordService.update(+userId, updateUserPasswordDto);
  }

  @Delete(':userId')
  remove(@Param('userId') userId: string) {
    return this.userPasswordService.remove(+userId);
  }
}
