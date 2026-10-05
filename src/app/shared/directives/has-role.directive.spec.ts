import { Component, signal } from '@angular/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { HasRoleDirective } from './has-role.directive';
import { AuthService } from '../../core/auth/auth.service';

/**
 * Unit tests for HasRoleDirective (*appHasRole).
 *
 * Test scenarios:
 * 1. User with role -> content visible
 * 2. User without role -> content hidden
 * 3. Null/empty roles input -> content hidden
 * 4. Reactive updates when roles change
 * 5. Multiple roles (OR logic)
 * 6. Unauthenticated user -> always hidden
 */

// Mock AuthService for testing
class MockAuthService {
  myRoles = signal<string[]>([]);
  isAuthenticated = signal<boolean>(true);

  hasRole(role: string): boolean {
    return this.myRoles().includes(role);
  }

  hasAnyRole(roles: string[] | string): boolean {
    const myRoles = this.myRoles();
    if (Array.isArray(roles)) return roles.some((r) => myRoles.includes(r));
    return myRoles.includes(roles as string);
  }

  hasAllRoles(roles: string[]): boolean {
    const myRoles = this.myRoles();
    return roles.every((r) => myRoles.includes(r));
  }

  // Helper methods for tests
  setRoles(roles: string[]) {
    this.myRoles.set(roles);
  }

  setAuthenticated(auth: boolean) {
    this.isAuthenticated.set(auth);
  }
}

// Test component with *appHasRole directive
@Component({
  standalone: true,
  imports: [HasRoleDirective],
  template: `
    <div id="admin-only" *appHasRole="'Admin'">Admin Content</div>
    <div id="manager-or-leader" *appHasRole="['Manager', 'Leader']">
      Manager or Leader Content
    </div>
    <div id="empty-role" *appHasRole="[]">Empty Role Content</div>
  `,
})
class TestHostComponent {}

describe('HasRoleDirective', () => {
  let component: TestHostComponent;
  let fixture: ComponentFixture<TestHostComponent>;
  let mockAuthService: MockAuthService;

  beforeEach(async () => {
    mockAuthService = new MockAuthService();

    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    component = fixture.componentInstance;
  });

  /**
   * Test 1: User with role should see content
   */
  it('should show content when user has the required role', () => {
    // Arrange
    mockAuthService.setRoles(['Admin', 'Manager']);
    mockAuthService.setAuthenticated(true);

    // Act
    fixture.detectChanges();

    // Assert
    const adminElement = fixture.nativeElement.querySelector('#admin-only');
    expect(adminElement).toBeTruthy();
    expect(adminElement?.textContent).toContain('Admin Content');
  });

  /**
   * Test 2: User without role should NOT see content
   */
  it('should hide content when user does not have the required role', () => {
    // Arrange
    mockAuthService.setRoles(['Viewer']); // No Admin role
    mockAuthService.setAuthenticated(true);

    // Act
    fixture.detectChanges();

    // Assert
    const adminElement = fixture.nativeElement.querySelector('#admin-only');
    expect(adminElement).toBeFalsy(); // Element should not exist in DOM
  });

  /**
   * Test 3: Multiple roles (OR logic) - should show if user has ANY role
   */
  it('should show content when user has at least one of multiple roles', () => {
    // Arrange
    mockAuthService.setRoles(['Leader']); // Has Leader but not Manager
    mockAuthService.setAuthenticated(true);

    // Act
    fixture.detectChanges();

    // Assert
    const multiRoleElement =
      fixture.nativeElement.querySelector('#manager-or-leader');
    expect(multiRoleElement).toBeTruthy();
    expect(multiRoleElement?.textContent).toContain(
      'Manager or Leader Content'
    );
  });

  /**
   * Test 4: Multiple roles - should hide if user has NONE of the roles
   */
  it('should hide content when user has none of the required roles', () => {
    // Arrange
    mockAuthService.setRoles(['Viewer']); // Has neither Manager nor Leader
    mockAuthService.setAuthenticated(true);

    // Act
    fixture.detectChanges();

    // Assert
    const multiRoleElement =
      fixture.nativeElement.querySelector('#manager-or-leader');
    expect(multiRoleElement).toBeFalsy();
  });

  /**
   * Test 5: Empty roles array should hide content
   */
  it('should hide content when roles input is empty array', () => {
    // Arrange
    mockAuthService.setRoles(['Admin', 'Manager']); // User has roles
    mockAuthService.setAuthenticated(true);

    // Act
    fixture.detectChanges();

    // Assert
    const emptyRoleElement = fixture.nativeElement.querySelector('#empty-role');
    expect(emptyRoleElement).toBeFalsy(); // Empty role requirement = always hide
  });

  /**
   * Test 6: Unauthenticated user should NEVER see content
   */
  it('should hide content when user is not authenticated', () => {
    // Arrange
    mockAuthService.setRoles(['Admin']); // Has role
    mockAuthService.setAuthenticated(false); // But not authenticated

    // Act
    fixture.detectChanges();

    // Assert
    const adminElement = fixture.nativeElement.querySelector('#admin-only');
    expect(adminElement).toBeFalsy();
  });

  /**
   * Test 7: Reactive updates - content should appear when role is granted
   */
  it('should reactively show content when user gains required role', () => {
    // Arrange - initially no roles
    mockAuthService.setRoles([]);
    mockAuthService.setAuthenticated(true);
    fixture.detectChanges();

    let adminElement = fixture.nativeElement.querySelector('#admin-only');
    expect(adminElement).toBeFalsy(); // Initially hidden

    // Act - grant Admin role
    mockAuthService.setRoles(['Admin']);
    fixture.detectChanges();

    // Assert - now visible
    adminElement = fixture.nativeElement.querySelector('#admin-only');
    expect(adminElement).toBeTruthy();
    expect(adminElement?.textContent).toContain('Admin Content');
  });

  /**
   * Test 8: Reactive updates - content should disappear when role is revoked
   */
  it('should reactively hide content when user loses required role', () => {
    // Arrange - initially has Admin role
    mockAuthService.setRoles(['Admin', 'Manager']);
    mockAuthService.setAuthenticated(true);
    fixture.detectChanges();

    let adminElement = fixture.nativeElement.querySelector('#admin-only');
    expect(adminElement).toBeTruthy(); // Initially visible

    // Act - revoke Admin role
    mockAuthService.setRoles(['Manager']); // Only Manager left
    fixture.detectChanges();

    // Assert - now hidden
    adminElement = fixture.nativeElement.querySelector('#admin-only');
    expect(adminElement).toBeFalsy();
  });

  /**
   * Test 9: Should handle role changes while maintaining other roles
   */
  it('should correctly update when roles change but maintain visibility', () => {
    // Arrange - has Manager
    mockAuthService.setRoles(['Manager']);
    mockAuthService.setAuthenticated(true);
    fixture.detectChanges();

    let multiRoleElement =
      fixture.nativeElement.querySelector('#manager-or-leader');
    expect(multiRoleElement).toBeTruthy();

    // Act - change to Leader (still satisfies Manager OR Leader)
    mockAuthService.setRoles(['Leader']);
    fixture.detectChanges();

    // Assert - still visible
    multiRoleElement =
      fixture.nativeElement.querySelector('#manager-or-leader');
    expect(multiRoleElement).toBeTruthy();
  });
});
