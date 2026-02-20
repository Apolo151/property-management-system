/**
 * QloApps Channel Manager Strategy (Adapter)
 *
 * Wraps the existing QloApps integration to implement IChannelManagerStrategy.
 * Delegates to existing QloApps hooks and services.
 */

import type {
  IChannelManagerStrategy,
  ChannelManagerName,
  SyncReservationInput,
  SyncAvailabilityInput,
  SyncRatesInput,
  SyncResult,
  ConnectionTestResult,
} from '../types.js';
import db from '../../../config/database.js';
import { QloAppsClient } from '../../qloapps/qloapps_client.js';
import { decrypt } from '../../../utils/encryption.js';
import {
  queueQloAppsReservationSyncHook,
  queueQloAppsAvailabilitySyncHook,
  queueQloAppsRateSyncHook,
} from '../../qloapps/hooks/sync_hooks.js';

export class QloAppsChannelStrategy implements IChannelManagerStrategy {
  private hotelId = '00000000-0000-0000-0000-000000000000';

  getName(): ChannelManagerName {
    return 'qloapps';
  }

  getDisplayName(): string {
    return 'QloApps';
  }

  async initialize(): Promise<void> {
    console.log('[QloAppsStrategy] Initialized');
  }

  async isEnabled(): Promise<boolean> {
    const config = await db('qloapps_config')
      .where({ hotel_id: this.hotelId })
      .first();

    return config?.sync_enabled === true;
  }

  /**
   * Check if outbound reservation sync is enabled
   */
  private async isOutboundReservationSyncEnabled(): Promise<boolean> {
    const config = await db('qloapps_config')
      .where({ hotel_id: this.hotelId })
      .first();

    if (!config) {
      console.warn(
        `[QloAppsStrategy] QloApps config not found for property ${this.hotelId}, outbound reservation sync disabled`
      );
      return false;
    }

    if (!config.sync_enabled) {
      console.warn(
        `[QloAppsStrategy] Global sync disabled for property ${this.hotelId}, outbound reservation sync disabled`
      );
      return false;
    }

    if (!config.sync_reservations_outbound) {
      console.warn(
        `[QloAppsStrategy] Outbound reservation sync disabled for property ${this.hotelId}`
      );
      return false;
    }

    return true;
  }

  async testConnection(): Promise<ConnectionTestResult> {
    const startTime = Date.now();
    console.log('[QloAppsStrategy] 🔍 Starting connection test...');
    console.log(`[QloAppsStrategy]   Hotel ID: ${this.hotelId}`);

    try {
      // Check if config exists
      console.log('[QloAppsStrategy] 📋 Querying database for config...');
      const configQueryStart = Date.now();
      const config = await db('qloapps_config')
        .where({ hotel_id: this.hotelId })
        .first();
      const configQueryDuration = Date.now() - configQueryStart;
      console.log(`[QloAppsStrategy]   Database query completed in ${configQueryDuration}ms`);

      if (!config) {
        console.error('[QloAppsStrategy] ❌ No QloApps config found in database');
        console.log(`[QloAppsStrategy]   Searched for hotel_id: ${this.hotelId}`);
        return {
          success: false,
          message: 'QloApps is not configured. Please set up the connection first.',
        };
      }

      console.log('[QloAppsStrategy] ✓ Config found in database:');
      console.log(`[QloAppsStrategy]   Config ID: ${config.id}`);
      console.log(`[QloAppsStrategy]   Base URL: ${config.base_url || '(missing)'}`);
      console.log(`[QloAppsStrategy]   API Key Encrypted: ${config.api_key_encrypted ? 'present' : '(missing)'}`);
      console.log(`[QloAppsStrategy]   QloApps Hotel ID: ${config.qloapps_hotel_id || '(missing)'}`);
      console.log(`[QloAppsStrategy]   Sync Enabled: ${config.sync_enabled}`);

      // Validate required fields
      if (!config.base_url || !config.api_key_encrypted || !config.qloapps_hotel_id) {
        console.error('[QloAppsStrategy] ❌ Configuration validation failed:');
        console.log(`[QloAppsStrategy]   base_url: ${config.base_url ? '✓' : '✗'}`);
        console.log(`[QloAppsStrategy]   api_key_encrypted: ${config.api_key_encrypted ? '✓' : '✗'}`);
        console.log(`[QloAppsStrategy]   qloapps_hotel_id: ${config.qloapps_hotel_id ? '✓' : '✗'}`);
        return {
          success: false,
          message: 'QloApps configuration is incomplete. Please reconfigure the connection.',
        };
      }

      console.log('[QloAppsStrategy] 🔐 Decrypting API key...');
      const decryptStart = Date.now();
      let apiKey: string;
      try {
        apiKey = decrypt(config.api_key_encrypted);
        const decryptDuration = Date.now() - decryptStart;
        console.log(`[QloAppsStrategy]   API key decrypted in ${decryptDuration}ms`);
        console.log(`[QloAppsStrategy]   API key length: ${apiKey.length} characters`);
        console.log(`[QloAppsStrategy]   API key preview: ${apiKey.substring(0, 8)}...`);
      } catch (decryptError) {
        console.error('[QloAppsStrategy] ❌ Failed to decrypt API key:', decryptError);
        return {
          success: false,
          message: 'Failed to decrypt API key. Please check your encryption configuration.',
        };
      }

      console.log('[QloAppsStrategy] 🔧 Creating QloAppsClient...');
      console.log('[QloAppsStrategy]   Client configuration:');
      console.log(`[QloAppsStrategy]     baseUrl: ${config.base_url}`);
      console.log(`[QloAppsStrategy]     hotelId: ${config.qloapps_hotel_id}`);
      console.log(`[QloAppsStrategy]     apiKey: ${apiKey.substring(0, 8)}...`);

      let client: QloAppsClient;
      try {
        client = new QloAppsClient({
          baseUrl: config.base_url,
          apiKey,
          hotelId: config.qloapps_hotel_id,
        });
        console.log('[QloAppsStrategy] ✓ QloAppsClient created successfully');
      } catch (clientError) {
        console.error('[QloAppsStrategy] ❌ Failed to create QloAppsClient:', clientError);
        return {
          success: false,
          message: `Failed to create client: ${clientError instanceof Error ? clientError.message : 'Unknown error'}`,
        };
      }

      // Test the connection
      console.log('[QloAppsStrategy] 🌐 Calling client.testConnection()...');
      const testStart = Date.now();
      const result = await client.testConnection();
      const testDuration = Date.now() - testStart;
      const totalLatency = Date.now() - startTime;

      console.log('[QloAppsStrategy] 📊 Test connection completed:');
      console.log(`[QloAppsStrategy]   Success: ${result.success}`);
      console.log(`[QloAppsStrategy]   Message: ${result.message}`);
      console.log(`[QloAppsStrategy]   Test duration: ${testDuration}ms`);
      console.log(`[QloAppsStrategy]   Total latency: ${totalLatency}ms`);
      if (result.hotelName) {
        console.log(`[QloAppsStrategy]   Hotel Name: ${result.hotelName}`);
      }
      if (result.error) {
        console.error(`[QloAppsStrategy]   Error: ${result.error}`);
      }

      return {
        success: result.success,
        message: result.message,
        latency: totalLatency,
      };
    } catch (error) {
      const totalLatency = Date.now() - startTime;
      console.error('[QloAppsStrategy] ❌ Test connection error:', error);
      console.error(`[QloAppsStrategy]   Error type: ${error instanceof Error ? error.constructor.name : typeof error}`);
      console.error(`[QloAppsStrategy]   Error message: ${error instanceof Error ? error.message : String(error)}`);
      if (error instanceof Error && error.stack) {
        console.error(`[QloAppsStrategy]   Stack trace:`, error.stack);
      }
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Connection test failed',
        latency: totalLatency,
      };
    }
  }

  async syncReservation(input: SyncReservationInput): Promise<SyncResult> {
    const startTime = Date.now();

    try {
      // Check if outbound reservation sync is enabled first
      if (!(await this.isOutboundReservationSyncEnabled())) {
        return {
          success: true,
          operationType: 'reservation',
          itemsProcessed: 0,
          duration: Date.now() - startTime,
        };
      }

      await queueQloAppsReservationSyncHook(input.reservationId, input.action);

      return {
        success: true,
        operationType: 'reservation',
        itemsProcessed: 1,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      console.error('[QloAppsStrategy] syncReservation error:', error);
      return {
        success: false,
        operationType: 'reservation',
        itemsProcessed: 0,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async syncAvailability(input: SyncAvailabilityInput): Promise<SyncResult> {
    const startTime = Date.now();

    try {
      // Check if enabled first
      if (!(await this.isEnabled())) {
        return {
          success: true,
          operationType: 'availability',
          itemsProcessed: 0,
          duration: Date.now() - startTime,
        };
      }

      await queueQloAppsAvailabilitySyncHook(
        input.roomTypeId,
        input.dateFrom,
        input.dateTo
      );

      return {
        success: true,
        operationType: 'availability',
        itemsProcessed: 1,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      console.error('[QloAppsStrategy] syncAvailability error:', error);
      return {
        success: false,
        operationType: 'availability',
        itemsProcessed: 0,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async syncRates(input: SyncRatesInput): Promise<SyncResult> {
    const startTime = Date.now();

    try {
      // Check if enabled first
      if (!(await this.isEnabled())) {
        return {
          success: true,
          operationType: 'rates',
          itemsProcessed: 0,
          duration: Date.now() - startTime,
        };
      }

      await queueQloAppsRateSyncHook(input.roomTypeId, input.dateFrom, input.dateTo);

      return {
        success: true,
        operationType: 'rates',
        itemsProcessed: 1,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      console.error('[QloAppsStrategy] syncRates error:', error);
      return {
        success: false,
        operationType: 'rates',
        itemsProcessed: 0,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
