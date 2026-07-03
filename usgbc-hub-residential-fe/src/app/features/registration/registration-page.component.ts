import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiClient } from '../../core/api/api-client';
import {
  FeeQuoteDto,
  MembershipLevel,
  RatingSystemDto,
  RegisterResponse,
} from '../../core/api/dto';

@Component({
  selector: 'app-registration-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <section class="wrap">
      <h1>Register a project</h1>

      @if (result()) {
        <div class="card confirm">
          <h2>Registration complete</h2>
          <p class="gbci">{{ result()?.project?.gbciDisplayId }}</p>
          <p>
            Invoice <strong>{{ result()?.invoice?.displayId }}</strong> —
            {{ result()?.invoice?.status }} ({{ usd(result()?.invoice?.totalCents ?? 0) }})
          </p>
          <a class="primary-link" [routerLink]="['/projects', result()?.project?.id, 'scorecard']">
            Go to scorecard
          </a>
        </div>
      } @else {
        <form class="card" [formGroup]="form" (ngSubmit)="submit()">
          <fieldset>
            <legend>Rating system &amp; membership</legend>
            <div class="field">
              <label>Rating system</label>
              <input type="text" [value]="ratingSystem()?.name ?? 'Loading…'" disabled />
            </div>
            <div class="field">
              <label for="membershipLevel">Membership level</label>
              <select id="membershipLevel" formControlName="membershipLevel"
                (change)="refreshQuote()">
                <option value="USGBC_MEMBER">USGBC member</option>
                <option value="NON_MEMBER">Non-member</option>
              </select>
            </div>
          </fieldset>

          <fieldset>
            <legend>Project details</legend>
            <div class="field">
              <label for="name">Project name</label>
              <input id="name" type="text" formControlName="name" />
            </div>
            <div class="field">
              <label for="buildingType">Building type</label>
              <select id="buildingType" formControlName="buildingType">
                <option value="SINGLE_FAMILY_DETACHED">Single family (detached)</option>
                <option value="SINGLE_FAMILY_ATTACHED">Single family (attached)</option>
                <option value="TOWNHOUSE">Townhouse</option>
              </select>
            </div>
            <div class="field">
              <label for="grossArea">Gross area (sq ft)</label>
              <input id="grossArea" type="number" min="0" formControlName="grossArea" />
            </div>
            <div class="field">
              <label for="targetCertificationLevel">Target certification level</label>
              <select id="targetCertificationLevel" formControlName="targetCertificationLevel">
                <option value="">—</option>
                @for (level of ratingSystem()?.certificationLevels ?? []; track level.name) {
                  <option [value]="level.name">{{ level.name }}</option>
                }
              </select>
            </div>
          </fieldset>

          <fieldset>
            <legend>Owner</legend>
            <div class="field"><label for="ownerName">Owner name</label>
              <input id="ownerName" type="text" formControlName="ownerName" /></div>
            <div class="field"><label for="ownerEmail">Owner email</label>
              <input id="ownerEmail" type="email" formControlName="ownerEmail" /></div>
            <div class="field"><label for="ownerOrganization">Organization</label>
              <input id="ownerOrganization" type="text" formControlName="ownerOrganization" /></div>
          </fieldset>

          <fieldset>
            <legend>Address</legend>
            <div class="field"><label for="addressLine1">Address line 1</label>
              <input id="addressLine1" type="text" formControlName="addressLine1" /></div>
            <div class="field"><label for="city">City</label>
              <input id="city" type="text" formControlName="city" /></div>
            <div class="field"><label for="region">State / region</label>
              <input id="region" type="text" formControlName="region" /></div>
            <div class="field"><label for="postalCode">Postal code</label>
              <input id="postalCode" type="text" formControlName="postalCode" /></div>
            <div class="field"><label for="country">Country (ISO alpha-2)</label>
              <input id="country" type="text" maxlength="2" formControlName="country" /></div>
          </fieldset>

          <fieldset>
            <legend>Fee &amp; payment</legend>
            @if (feeQuote(); as q) {
              <p class="fee">{{ usd(q.totalCents) }}
                <span class="hint">({{ form.value.membershipLevel }})</span></p>
              @if (q.warnings.length) {
                <p class="error">Fee schedule unavailable — contact an administrator.</p>
              }
            }
            <div class="field">
              <label for="paymentChoice">Payment</label>
              <select id="paymentChoice" formControlName="paymentChoice">
                <option value="PAY_NOW">Pay now</option>
                <option value="PAY_LATER">Pay later</option>
              </select>
            </div>
          </fieldset>

          <fieldset>
            <legend>Agreement</legend>
            <p class="agreement-text">{{ agreementText }}</p>
            <label class="checkbox">
              <input type="checkbox" formControlName="agreementAccepted" />
              I have read and accept the certification agreement.
            </label>
          </fieldset>

          @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
          <button class="primary" type="submit" [disabled]="form.invalid || submitting()">
            {{ submitting() ? 'Registering…' : 'Register project' }}
          </button>
        </form>
      }
    </section>
  `,
  styles: [
    `
      .wrap { max-width: 640px; margin: 1.5rem auto; padding: 0 1rem; }
      fieldset { border: 1px solid var(--usgbc-border); border-radius: 8px; margin-bottom: 1rem; }
      legend { font-weight: 700; padding: 0 0.4rem; }
      .fee { font-size: 1.5rem; font-weight: 700; color: var(--usgbc-green-dark); }
      .agreement-text { font-size: 0.8rem; color: var(--usgbc-muted); max-height: 120px; overflow: auto; }
      .checkbox { display: flex; gap: 0.5rem; align-items: center; }
      .confirm .gbci { font-size: 2rem; font-weight: 800; color: var(--usgbc-green-dark); }
      .primary-link { display: inline-block; margin-top: 0.5rem; font-weight: 600; }
    `,
  ],
})
export class RegistrationPageComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ApiClient);
  private readonly router = inject(Router);

  readonly ratingSystem = signal<RatingSystemDto | null>(null);
  readonly feeQuote = signal<FeeQuoteDto | null>(null);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly result = signal<RegisterResponse | null>(null);
  readonly agreementText =
    'By registering, you affirm the submitted information is accurate and agree to the GBCI ' +
    'certification policies. Fees are non-refundable once a project is registered. (Demo agreement.)';

  readonly form = this.fb.nonNullable.group({
    membershipLevel: ['USGBC_MEMBER' as MembershipLevel, Validators.required],
    name: ['', Validators.required],
    buildingType: ['SINGLE_FAMILY_DETACHED', Validators.required],
    grossArea: [2000, [Validators.required, Validators.min(0)]],
    targetCertificationLevel: [''],
    ownerName: ['', Validators.required],
    ownerEmail: ['', [Validators.required, Validators.email]],
    ownerOrganization: [''],
    addressLine1: ['', Validators.required],
    city: ['', Validators.required],
    region: ['', Validators.required],
    postalCode: ['', Validators.required],
    country: ['US', [Validators.required, Validators.maxLength(2)]],
    paymentChoice: ['PAY_NOW', Validators.required],
    agreementAccepted: [false, Validators.requiredTrue],
  });

  async ngOnInit(): Promise<void> {
    try {
      const rs = await firstValueFrom(this.api.getRatingSystem('leed_v4_1_sf'));
      this.ratingSystem.set(rs);
      await this.refreshQuote();
    } catch {
      this.error.set('Could not load the rating system.');
    }
  }

  async refreshQuote(): Promise<void> {
    const level = this.form.getRawValue().membershipLevel;
    try {
      this.feeQuote.set(await firstValueFrom(this.api.getFeeQuote('leed_v4_1_sf', level)));
    } catch {
      this.feeQuote.set(null);
    }
  }

  usd(cents: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
      cents / 100,
    );
  }

  async submit(): Promise<void> {
    if (this.form.invalid) return;
    const rs = this.ratingSystem();
    if (!rs) return;
    this.submitting.set(true);
    this.error.set(null);
    const v = this.form.getRawValue();
    try {
      const res = (await firstValueFrom(
        this.api.createProject({
          mode: 'register',
          ratingSystemId: rs.id,
          name: v.name,
          membershipLevel: v.membershipLevel,
          buildingType: v.buildingType as never,
          numberOfUnits: 1,
          grossArea: v.grossArea,
          targetCertificationLevel: v.targetCertificationLevel || undefined,
          ownerName: v.ownerName,
          ownerEmail: v.ownerEmail,
          ownerOrganization: v.ownerOrganization || undefined,
          addressLine1: v.addressLine1,
          city: v.city,
          region: v.region,
          postalCode: v.postalCode,
          country: v.country.toUpperCase(),
          paymentChoice: v.paymentChoice as never,
          acceptedAgreementVersion: 'v1.0',
        }),
      )) as RegisterResponse;
      this.result.set(res);
    } catch (err) {
      this.error.set('Registration failed. Check the required fields and try again.');
      void err;
    } finally {
      this.submitting.set(false);
    }
  }
}
