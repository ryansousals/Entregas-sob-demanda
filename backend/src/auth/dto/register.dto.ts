import {
  IsEmail,
  IsString,
  MaxLength,
  MinLength,
  IsOptional,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class RegisterDto {
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Matches(/\S/, { message: 'Informe seu nome.' })
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(64)
  password!: string;

  @IsOptional()
  @IsString()
  @Matches(/^(?=(?:\D*\d){10,13}\D*$)\+?[0-9()\s.-]{10,25}$/, {
    message: 'Informe um telefone válido com DDD.',
  })
  phone?: string;
}
