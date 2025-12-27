import db from '../../../config/database.js';
import type { Beds24Guest } from '../beds24_types.js';
import { mapBeds24GuestToPms } from '../mappers/guest_mapper.js';

/**
 * Service for matching Beds24 guests with PMS guests
 */
export class GuestMatchingService {
  /**
   * Get or create the default "Unknown Guest" record
   * Used when booking has no guest information
   */
  async getUnknownGuestId(): Promise<string> {
    // Find existing "Unknown Guest" record
    const unknownGuest = await db('guests')
      .where({ name: 'Unknown Guest', email: null, phone: null })
      .first();
    
    if (unknownGuest) {
      return unknownGuest.id;
    }
    
    // Create single "Unknown Guest" record if it doesn't exist
    const [newUnknownGuest] = await db('guests')
      .insert({
        name: 'Unknown Guest',
        email: null,
        phone: null,
        past_stays: 0,
      })
      .returning('id');
    
    return newUnknownGuest.id;
  }

  /**
   * Find or create guest from Beds24 booking data
   * Returns PMS guest ID
   */
  async findOrCreateGuest(beds24Guest: Beds24Guest, beds24GuestId?: number): Promise<string> {
    // Validate that we have at least some identifying information
    const hasName = !!(beds24Guest.firstName || beds24Guest.lastName);
    const hasEmail = !!beds24Guest.email;
    const hasPhone = !!beds24Guest.phone;
    
    // If no identifying information, use "Unknown Guest" instead of creating duplicates
    if (!hasName && !hasEmail && !hasPhone) {
      return await this.getUnknownGuestId();
    }

    // Step 1: Try to match by beds24_guest_id (if we store it)
    // Note: We don't currently store beds24_guest_id, but this is for future use
    if (beds24GuestId) {
      // Could add beds24_guest_id column to guests table in future
      // For now, skip this step
    }

    // Step 2: Match by email (case-insensitive)
    if (beds24Guest.email) {
      const guestByEmail = await db('guests')
        .whereRaw('LOWER(email) = LOWER(?)', [beds24Guest.email])
        .first();

      if (guestByEmail) {
        // Update guest with latest Beds24 data (merge)
        await this.mergeGuestData(guestByEmail.id, beds24Guest);
        return guestByEmail.id;
      }
    }

    // Step 3: Match by phone (normalized)
    if (beds24Guest.phone) {
      const normalizedPhone = this.normalizePhone(beds24Guest.phone);
      const guestByPhone = await db('guests')
        .whereNotNull('phone')
        .whereRaw('REPLACE(REPLACE(REPLACE(REPLACE(phone, \' \', \'\'), \'-\', \'\'), \'(\', \'\'), \')\', \'\') = ?', [normalizedPhone])
        .first();

      if (guestByPhone) {
        // Update guest with latest Beds24 data
        await this.mergeGuestData(guestByPhone.id, beds24Guest);
        return guestByPhone.id;
      }
    }

    // Step 4: Create new guest with the mapped data
    const guestData = mapBeds24GuestToPms(beds24Guest);
    
    // Double-check we're not creating another "Unknown Guest" or "Guest"
    if (guestData.name === 'Unknown Guest' || guestData.name === 'Guest') {
      return await this.getUnknownGuestId();
    }
    
    const [newGuest] = await db('guests')
      .insert({
        name: guestData.name,
        email: guestData.email || null,
        phone: guestData.phone || null,
        past_stays: 0,
      })
      .returning('id');

    return newGuest.id;
  }

  /**
   * Merge Beds24 guest data into existing PMS guest
   * Prefers most recent data
   */
  private async mergeGuestData(guestId: string, beds24Guest: Beds24Guest): Promise<void> {
    const existingGuest = await db('guests').where({ id: guestId }).first();
    if (!existingGuest) {
      return;
    }

    const updates: any = {};

    // Update name if Beds24 has more complete name
    if (beds24Guest.firstName && beds24Guest.lastName) {
      const beds24FullName = `${beds24Guest.firstName} ${beds24Guest.lastName}`.trim();
      if (beds24FullName.length > (existingGuest.name?.length || 0)) {
        updates.name = beds24FullName;
      }
    }

    // Update email if missing or Beds24 has one
    if (beds24Guest.email && !existingGuest.email) {
      updates.email = beds24Guest.email;
    }

    // Update phone if missing or Beds24 has one
    if (beds24Guest.phone && !existingGuest.phone) {
      updates.phone = beds24Guest.phone;
    }

    if (Object.keys(updates).length > 0) {
      await db('guests')
        .where({ id: guestId })
        .update({
          ...updates,
          updated_at: new Date(),
        });
    }
  }

  /**
   * Normalize phone number (remove spaces, dashes, parentheses)
   */
  private normalizePhone(phone: string): string {
    return phone.replace(/[\s\-\(\)]/g, '');
  }
}

