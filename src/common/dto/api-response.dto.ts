import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApiMeta {
  @ApiPropertyOptional({ description: 'Opaque cursor for the next page', nullable: true })
  nextCursor?: string | null;

  @ApiPropertyOptional({ description: 'Whether more items exist after this page' })
  hasMore?: boolean;

  @ApiPropertyOptional({ description: 'Total matching rows, when cheap to compute' })
  total?: number;
}

export class ApiSuccessResponse<T> {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty()
  data!: T;

  @ApiPropertyOptional({ type: ApiMeta })
  meta?: ApiMeta;
}

export class ApiErrorBody {
  @ApiProperty({ example: 'VALIDATION_FAILED' })
  code!: string;

  @ApiProperty({ example: 'latitude must be between -90 and 90' })
  message!: string;

  @ApiPropertyOptional({ description: 'Field-level validation details' })
  details?: Record<string, string[]>;
}

export class ApiErrorResponse {
  @ApiProperty({ example: false })
  success!: false;

  @ApiProperty({ type: ApiErrorBody })
  error!: ApiErrorBody;
}

/** Marker used by the transform interceptor to attach `meta` to a response. */
export class Paginated<T> {
  constructor(
    readonly items: T[],
    readonly meta: ApiMeta,
  ) {}
}
