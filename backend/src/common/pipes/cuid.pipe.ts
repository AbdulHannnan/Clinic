import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

// Prisma's default cuid: a leading 'c' followed by 24 lowercase base-36 chars.
const CUID = /^c[a-z0-9]{24}$/;

/** Rejects a route param that isn't a Prisma cuid, so handlers never query on a malformed id. */
@Injectable()
export class CuidPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (typeof value !== 'string' || !CUID.test(value)) throw new BadRequestException('Invalid id');
    return value;
  }
}
