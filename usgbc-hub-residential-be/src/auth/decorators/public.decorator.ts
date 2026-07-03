import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Marks a route as public — bypasses the global JwtAuthGuard (BR-Z2 public list). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
