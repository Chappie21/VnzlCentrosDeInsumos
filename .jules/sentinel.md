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

## 2026-07-02 - Rate Limit Bypass via Header Spoofing

**Vulnerability:** The NestJS `RateLimitGuard` used `req.header("x-fingerprint") || req.ip` as the cache key for rate limiting. Because the client controls the `x-fingerprint` header, an attacker could bypass the rate limit completely by rotating this header on every request, completely ignoring the IP fallback.
**Learning:** Never trust client-provided headers as the primary key for rate limiting. Attackers can easily spoof them. The primary rate limiting key should always be the source IP address (which is harder to spoof because the TCP connection must be established to get a response).
**Prevention:** Use `req.ip` as the primary rate limit key. If an application requires limiting by a secondary client identifier (like a fingerprint or a user ID), apply *both* rate limits (first the IP limit, then the secondary limit) to prevent rotating identifiers from bypassing the global IP limit.

## 2026-07-03 - User Enumeration via Timing Attacks in Login Endpoints

**Vulnerability:** The login endpoints (`AdminService.login` and `AuthService.login`) were vulnerable to user enumeration via timing attacks. If an invalid user was provided or the admin was inactive, the application skipped the `bcrypt.compare` operation. By analyzing response times, an attacker could enumerate which emails or cedulas were registered in the database, breaking privacy and providing targets for brute-force attacks.
**Learning:** `bcrypt.compare` is computationally expensive by design. Conditional execution of this function based on the existence of a user creates a significant, observable timing difference in the response.
**Prevention:** Always execute `bcrypt.compare` with a dummy hash (with the same cost factor as your real hashes, e.g., 10) when the requested user is not found or is inactive. Ensure the dummy check is structured such that `bcrypt.compare` runs uniformly across all paths, masking whether the underlying reason for authentication failure was a bad username or a bad password.

## 2026-07-04 - Logic Bypass via Shared Base DTO Constraints

**Vulnerability:** A base DTO (`MovimientoDto`) allowed negative quantities because it was intended to be shared across generic operations (where `cantidad` represents both positive inputs and negative outputs). However, specific endpoints (`addOne` and `batch` in `HistorialController`) meant only for positive additions accepted negative values via inherited DTO properties. This lack of constraint in derived classes allowed volunteers to bypass the `JefeGuard` required for adjustments by passing a negative quantity to a positive-only endpoint, effectively subtracting stock unauthorizedly.
**Learning:** Reusing generic DTOs across endpoints with different authorization levels or expected business logic requires careful constraints. Missing boundary checks like `@Min(1)` on derived inputs can lead to severe business logic bypasses (e.g., unauthorized stock manipulation, negative items generating stock).
**Prevention:** Apply specific constraints to derived DTOs (using the `declare` keyword for uninitialized properties in TypeScript, e.g., `@Min(1) declare cantidad: number;`) rather than keeping them loose in the shared base class. Ensure that every endpoint strictly bounds its inputs according to its specific use case.
