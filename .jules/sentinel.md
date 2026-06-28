## 2026-06-25 - Validation Bypass in Typescript Intersection Types and Missing Authorization

**Vulnerability:** A controller method `add` used an intersection type `@Body() body: { centroId: string } & MovimientoDto`. This resulted in complete bypass of NestJS ValidationPipe because `reflect-metadata` treats intersection types as generic `Object`s at runtime, losing all validation decorators. In addition, the `addOne` service method it called lacked a check that the targeted `insumoId` belonged to the `centroId` provided, leading to an IDOR (authorization bypass).

**Learning:** NestJS ValidationPipe combined with `class-validator` strictly requires named classes for input bodies. Typescript intersection types (`TypeA & TypeB`) or interfaces do not emit the required metadata for runtime validation. Also, endpoints taking nested or referenced resource IDs (like `insumoId` alongside `centroId`) must always verify the relationship (ownership) between them to prevent IDOR.

**Prevention:** Always use classes that `extend` base classes when combining DTOs instead of using intersection types. Always verify ownership/relationship of object IDs passed in requests, particularly when the authorization guard only validates top-level contextual IDs (like `centroId`).
