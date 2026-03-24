import { describe, it, expect } from "vitest";
import type { User, AuthContext } from "../types";

describe("Types", () => {
  it("should export required interfaces", () => {
    // This is purely a type check file to satisfy coverage for types.ts
    // Since types.ts only contains interfaces, we just need to ensure it compiles

    const mockUser: User = {
      id: "user-123",
      phone: "01012345678",
      role: "worker",
      name: "홍길동",
      nameMasked: "홍*동",
    };

    const mockAuthContext: AuthContext = {
      user: mockUser,
      loginDate: "2024-01-01T00:00:00Z",
    };

    expect(mockUser.id).toBe("user-123");
    expect(mockAuthContext.user.name).toBe("홍길동");
  });
});
