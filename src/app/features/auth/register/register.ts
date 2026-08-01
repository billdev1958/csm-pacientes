import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrl: './register.scss',
})
export class Register {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  /** Contraseña a la vista: se escribe una nueva y no hay campo de confirmación. */
  protected readonly showPassword = signal(false);

  /**
   * La CURP se valida con longitud exacta de 18, igual que el backend, para no
   * enviar una petición que se sabe que va a fallar.
   */
  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    lastname1: ['', [Validators.required]],
    lastname2: [''],
    curp: ['', [Validators.required, Validators.minLength(18), Validators.maxLength(18)]],
    sex: ['', [Validators.required]],
    phoneNumber: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  protected control(name: keyof typeof this.form.controls) {
    return this.form.controls[name];
  }

  protected togglePassword(): void {
    this.showPassword.update((visible) => !visible);
  }

  protected onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const value = this.form.getRawValue();

    this.auth
      .register({ ...value, sex: value.sex as 'M' | 'F' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.isSubmitting.set(false);
          if (response.status === 'success') {
            this.notifications.show('Cuenta creada. Ya puedes iniciar sesión.', 'success');
            void this.router.navigate(['/login']);
            return;
          }
          this.errorMessage.set(response.message ?? 'No se pudo crear la cuenta.');
        },
        error: (err: { error?: { message?: string } }) => {
          this.isSubmitting.set(false);
          // El backend explica el motivo real (por ejemplo, CURP duplicada).
          this.errorMessage.set(err.error?.message ?? 'No se pudo crear la cuenta.');
        },
      });
  }
}
