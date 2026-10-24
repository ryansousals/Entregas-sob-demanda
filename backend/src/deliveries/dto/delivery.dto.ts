import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const trimText = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class QuoteDeliveryDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.1)
  @Max(200)
  distanceKm!: number;
}

export class CreateDeliveryDto extends QuoteDeliveryDto {
  @Transform(trimText)
  @IsString()
  @MinLength(5)
  @MaxLength(300)
  pickupAddress!: string;

  @Transform(trimText)
  @IsString()
  @MinLength(5)
  @MaxLength(300)
  dropoffAddress!: string;

  @Transform(trimText)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  recipientName!: string;

  @Transform(trimText)
  @IsString()
  @Matches(/^(?=(?:\D*\d){10,13}\D*$)\+?[0-9()\s.-]{10,25}$/, {
    message: 'Informe um telefone válido para o destinatário.',
  })
  recipientPhone!: string;

  @Transform(trimText)
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  packageDescription!: string;

  @Transform(trimText)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  pickupReference?: string;

  @Transform(trimText)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  dropoffReference?: string;
}

export class UpdateDeliveryStatusDto {
  @IsIn(['PICKED_UP', 'IN_TRANSIT', 'DELIVERED'])
  status!: 'PICKED_UP' | 'IN_TRANSIT' | 'DELIVERED';
}

export class AssignDeliveryDto {
  @IsUUID()
  courierId!: string;
}
