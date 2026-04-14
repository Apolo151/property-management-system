/**
 * Channel Manager Controller
 *
 * Handles API endpoints for channel manager operations:
 * - Get status of all channel managers
 * - Switch active channel manager
 * - Test connections
 */

import type { Request, Response, NextFunction } from 'express';
import { QloAppsClient } from '../../integrations/qloapps/qloapps_client.js';
import { QloAppsConfigRepository } from '../qloapps/qloapps_repository.js';

/**
 * Get channel manager status
 * GET /api/v1/settings/channel-manager
 */
export async function getChannelManagerStatusHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const repository = new QloAppsConfigRepository();
    const config = await repository.getConfig();
    res.json({
      active: 'qloapps',
      available: ['qloapps'],
      qloapps: {
        configured: !!config?.api_key_encrypted,
        syncEnabled: config?.sync_enabled || false,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Switch active channel manager
 * POST /api/v1/settings/channel-manager/switch
 */
export async function switchChannelManagerHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { channelManager } = req.body;

    if (!channelManager) {
      res.status(400).json({ error: 'channelManager is required' });
      return;
    }

    if (channelManager !== 'qloapps') {
      res.status(400).json({ error: 'Only qloapps is supported' });
      return;
    }

    const repository = new QloAppsConfigRepository();
    const config = await repository.getConfig();
    if (!config) {
      res.status(400).json({ error: 'QloApps is not configured' });
      return;
    }

    await repository.updateConfig({ syncEnabled: true });
    res.json({
      success: true,
      message: 'QloApps is active',
    });
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
      return;
    }
    next(error);
  }
}

/**
 * Test QloApps connection
 * POST /api/v1/settings/channel-manager/test-qloapps
 */
export async function testQloAppsConnectionHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const repository = new QloAppsConfigRepository();
    const config = await repository.getConfig();
    const apiKey = await repository.getDecryptedApiKey();

    if (!config || !apiKey) {
      res.status(400).json({
        success: false,
        message: 'QloApps is not configured',
      });
      return;
    }

    const client = new QloAppsClient({
      baseUrl: config.base_url,
      apiKey,
      hotelId: config.qloapps_hotel_id,
    });
    const result = await client.testConnection();
    res.json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * Setup QloApps configuration
 * POST /api/v1/settings/channel-manager/setup-qloapps
 */
export async function setupQloAppsConnectionHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { baseUrl, apiKey, qloAppsHotelId, syncInterval } = req.body;

    // Import the repository
    const { QloAppsConfigRepository } = await import(
      '../../services/qloapps/qloapps_repository.js'
    );
    const repository = new QloAppsConfigRepository();

    // Check if config already exists (edit mode vs new setup)
    const existingConfig = await repository.getConfig();
    const isEdit = !!existingConfig;

    // Validate required fields
    if (!baseUrl || !qloAppsHotelId) {
      res.status(400).json({
        success: false,
        error: 'baseUrl and qloAppsHotelId are required',
      });
      return;
    }

    // API key is required for new setup, optional for edit
    if (!isEdit && !apiKey) {
      res.status(400).json({
        success: false,
        error: 'apiKey is required for new setup',
      });
      return;
    }

    // Sanitize and validate baseUrl
    let sanitizedBaseUrl = String(baseUrl).trim();
    
    // Remove trailing slash
    if (sanitizedBaseUrl.endsWith('/')) {
      sanitizedBaseUrl = sanitizedBaseUrl.slice(0, -1);
    }

    // Remove /api or /api/ suffix if present (endpoints already include this)
    if (sanitizedBaseUrl.endsWith('/api')) {
      sanitizedBaseUrl = sanitizedBaseUrl.slice(0, -4);
    }

    // Validate URL format
    if (!sanitizedBaseUrl.match(/^https?:\/\/.+/)) {
      res.status(400).json({
        success: false,
        error: 'Base URL must start with http:// or https:// and include a domain (e.g., https://hotel.qloapps.com)',
      });
      return;
    }

    // Additional URL validation
    try {
      new URL(sanitizedBaseUrl);
    } catch {
      res.status(400).json({
        success: false,
        error: 'Invalid base URL format. Please provide a valid URL.',
      });
      return;
    }

    // Validate hotel ID
    const hotelId = parseInt(qloAppsHotelId, 10);
    if (isNaN(hotelId) || hotelId <= 0) {
      res.status(400).json({
        success: false,
        error: 'Hotel ID must be a positive number',
      });
      return;
    }

    // Prepare config data
    const configData: any = {
      baseUrl: sanitizedBaseUrl,
      qloAppsHotelId: hotelId,
      syncIntervalMinutes: syncInterval ? parseInt(syncInterval, 10) : 5,
      syncEnabled: true,
      syncReservationsInbound: true,
      syncReservationsOutbound: true,
      syncAvailability: true,
      syncRates: true,
    };

    // Only include API key if provided (for new setup or if user wants to change it)
    if (apiKey && apiKey.trim()) {
      configData.apiKey = apiKey;
    } else if (isEdit && existingConfig) {
      // For edit mode, use existing encrypted API key
      const decryptedKey = await repository.getDecryptedApiKey();
      if (decryptedKey) {
        configData.apiKey = decryptedKey;
      }
    }

    // Save configuration
    await repository.saveConfig(configData);

    res.json({
      success: true,
      message: isEdit ? 'QloApps configuration updated successfully' : 'QloApps configuration saved successfully',
      switched: true,
    });
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
      return;
    }
    next(error);
  }
}
