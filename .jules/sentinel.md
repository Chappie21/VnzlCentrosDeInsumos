## 2026-06-25 - Validation Bypass in Typescript Intersection Types and Missing Authorization

**Vulnerability:** A controller method `add` used an intersection type `@Body() body: { centroId: string } & MovimientoDto`. This resulted in complete bypass of NestJS ValidationPipe because `reflect-metadata` treats intersection types as generic `Object`s at runtime, losing all validation decorators. In addition, the `addOne` service method it called lacked a check that the targeted `insumoId` belonged to the `centroId` provided, leading to an IDOR (authorization bypass).

**Learning:** NestJS ValidationPipe combined with `class-validator` strictly requires named classes for input bodies. Typescript intersection types (`TypeA & TypeB`) or interfaces do not emit the required metadata for runtime validation. Also, endpoints taking nested or referenced resource IDs (like `insumoId` alongside `centroId`) must always verify the relationship (ownership) between them to prevent IDOR.

**Prevention:** Always use classes that `extend` base classes when combining DTOs instead of using intersection types. Always verify ownership/relationship of object IDs passed in requests, particularly when the authorization guard only validates top-level contextual IDs (like `centroId`).

## 2026-06-30 - Missing Security Headers

**Vulnerability:** Missing security headers on the API server. In particular, the lack of `Helmet` can leave the application open to various web vulnerabilities.
**Learning:** Adding `Helmet` is a straightforward way to add essential security headers, but setting it blindly can break functionality. In this application, image uploads are served directly from the `/uploads` directory using `express.static`, and the Next.js frontend fetches them across domains. The default `Helmet` policy blocks this.
**Prevention:** Always use `Helmet` to provide defense in depth via HTTP security headers, but ensure that features like cross-origin image loading (if necessary) are explicitly allowed by configuring `crossOriginResourcePolicy: { policy: "cross-origin" }`.

## 2026-07-01 - Parameter Pollution / IDOR in NestJS Guards

**Vulnerability:** The NestJS `VoluntarioGuard` and `JefeGuard` checked either `req.body.centroId` or `req.params.centroId` using a loose nullish coalescing operator (`req.body?.centroId ?? req.params?.centroId` or vice-versa). This allowed an attacker to bypass authorization on routes with path parameters (e.g., `/centros/:centroId`) by injecting a different `centroId` in the request body that they actually own, causing the guard to authorize the request while the controller executed the action on the targeted ID in the path.
**Learning:** Security guards must never allow ambiguity between path parameters and body parameters. If an endpoint expects a resource ID in the URL, the guard must prioritize validating that specific URL parameter. If the same ID can optionally appear in the body, the guard must ensure they match to prevent HTTP Parameter Pollution (HPP) leading to IDOR.
**Prevention:** Explicitly fetch both `req.params.id` and `req.body.id`. If both are provided, assert that they are strictly equal (`!==`), throwing a `BadRequestException` if they differ. Use the resolved ID for the database authorization check.
