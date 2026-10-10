import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UsuarioActual } from './roles.decorator';

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): UsuarioActual => ctx.switchToHttp().getRequest().user,
);
