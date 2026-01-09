/**
 * QloApps Room Mapper
 *
 * Maps between PMS individual rooms and QloApps hotel rooms.
 * Handles room numbers, status, floor mapping, and room type associations.
 */

import type {
  QloAppsRoom,
  QloAppsRoomCreateRequest,
  QloAppsRoomUpdateRequest,
} from '../qloapps_types.js';
import type { RoomType } from '../../../services/room_types/room_types_types.js';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * PMS Room creation request (simplified for mapping purposes)
 */
export interface CreateRoomRequest {
  room_number: string;
  type: 'Single' | 'Double' | 'Suite' | 'General' | 'Other';
  status: 'Available' | 'Occupied' | 'Cleaning' | 'Out of Service';
  price_per_night: number;
  floor: number;
  features?: string[];
  description?: string;
}

/**
 * PMS Room (simplified for mapping purposes)
 */
export interface Room {
  id: string;
  room_number: string;
  type: string;
  status: string;
  price_per_night: number;
  floor: number;
  features?: string[];
  description?: string;
}

// ============================================================================
// QloApps → PMS Mapping
// ============================================================================

/**
 * Map QloApps room to PMS room data for creation
 * @param qloAppsRoom QloApps hotel room
 * @param roomType Associated PMS room type (for price and type info)
 * @returns PMS room creation request
 */
export function mapQloAppsRoomToPms(
  qloAppsRoom: QloAppsRoom,
  roomType: RoomType
): CreateRoomRequest {
  return {
    room_number: qloAppsRoom.room_num,
    type: deriveRoomTypeFromName(roomType.name),
    status: mapQloAppsStatusToPmsRoomStatus(qloAppsRoom.id_status),
    price_per_night: roomType.price_per_night,
    floor: parseFloorString(qloAppsRoom.floor),
    features: roomType.features || [],
    description: qloAppsRoom.comment || roomType.description,
  };
}

/**
 * Map QloApps room status to PMS room status
 * @param status QloApps status ID
 * @returns PMS room status
 */
export function mapQloAppsStatusToPmsRoomStatus(
  status: number
): 'Available' | 'Occupied' | 'Cleaning' | 'Out of Service' {
  switch (status) {
    case 1:
      return 'Available';
    case 2:
      return 'Occupied';
    case 3:
      return 'Cleaning';
    case 4:
      return 'Out of Service';
    default:
      return 'Available'; // Default to available for unknown statuses
  }
}

/**
 * Parse floor string to integer
 * Converts "First", "Second", "Ground", etc. to numbers
 * @param floor Floor string from QloApps
 * @returns Floor number
 */
export function parseFloorString(floor: string): number {
  const floorLower = floor.toLowerCase().trim();

  // Handle common floor names
  const floorMap: Record<string, number> = {
    ground: 0,
    'ground floor': 0,
    first: 1,
    '1st': 1,
    second: 2,
    '2nd': 2,
    third: 3,
    '3rd': 3,
    fourth: 4,
    '4th': 4,
    fifth: 5,
    '5th': 5,
    sixth: 6,
    '6th': 6,
    seventh: 7,
    '7th': 7,
    eighth: 8,
    '8th': 8,
    ninth: 9,
    '9th': 9,
    tenth: 10,
    '10th': 10,
  };

  if (floorMap[floorLower] !== undefined) {
    return floorMap[floorLower]!;
  }

  // Try to parse as number
  const parsed = parseInt(floor, 10);
  if (!isNaN(parsed)) {
    return parsed;
  }

  // Default to floor 1 if unable to parse
  return 1;
}

/**
 * Derive PMS room type from room type name
 * Intelligently maps room type names to PMS type enum
 * @param name Room type name
 * @returns PMS room type
 */
export function deriveRoomTypeFromName(
  name: string
): 'Single' | 'Double' | 'Suite' | 'General' | 'Other' {
  const nameLower = name.toLowerCase();

  if (nameLower.includes('single')) {
    return 'Single';
  }
  if (nameLower.includes('double') || nameLower.includes('twin')) {
    return 'Double';
  }
  if (nameLower.includes('suite') || nameLower.includes('deluxe') || nameLower.includes('luxury')) {
    return 'Suite';
  }
  if (nameLower.includes('general')) {
    return 'General';
  }

  // Default to 'Other' for unrecognized types
  return 'Other';
}

// ============================================================================
// PMS → QloApps Mapping
// ============================================================================

/**
 * Map PMS room to QloApps room create request
 * @param pmsRoom PMS room
 * @param qloAppsProductId QloApps product/room type ID
 * @param qloAppsHotelId QloApps hotel ID
 * @returns QloApps room creation request
 */
export function mapPmsRoomToQloApps(
  pmsRoom: Room,
  qloAppsProductId: number,
  qloAppsHotelId: number
): QloAppsRoomCreateRequest {
  return {
    id_product: qloAppsProductId,
    id_hotel: qloAppsHotelId,
    room_num: pmsRoom.room_number,
    id_status: mapPmsStatusToQloAppsStatus(pmsRoom.status),
    floor: formatFloorNumber(pmsRoom.floor),
    comment: pmsRoom.description || '',
  };
}

/**
 * Map PMS room to QloApps room update request
 * @param pmsRoom PMS room
 * @param qloAppsRoomId QloApps room ID
 * @returns QloApps room update request
 */
export function mapPmsRoomToQloAppsUpdate(
  pmsRoom: Room,
  qloAppsRoomId: number
): QloAppsRoomUpdateRequest {
  return {
    id: qloAppsRoomId,
    room_num: pmsRoom.room_number,
    id_status: mapPmsStatusToQloAppsStatus(pmsRoom.status),
    floor: formatFloorNumber(pmsRoom.floor),
    comment: pmsRoom.description || '',
  };
}

/**
 * Map PMS room status to QloApps status ID
 * @param status PMS room status
 * @returns QloApps status ID
 */
export function mapPmsStatusToQloAppsStatus(status: string): number {
  switch (status) {
    case 'Available':
      return 1;
    case 'Occupied':
      return 2;
    case 'Cleaning':
      return 3;
    case 'Out of Service':
      return 4;
    default:
      return 1; // Default to available
  }
}

/**
 * Format floor number as string for QloApps
 * Converts numbers to ordinal names (1 → "First", 2 → "Second", etc.)
 * @param floor Floor number
 * @returns Floor string
 */
export function formatFloorNumber(floor: number): string {
  const floorNames: Record<number, string> = {
    0: 'Ground',
    1: 'First',
    2: 'Second',
    3: 'Third',
    4: 'Fourth',
    5: 'Fifth',
    6: 'Sixth',
    7: 'Seventh',
    8: 'Eighth',
    9: 'Ninth',
    10: 'Tenth',
  };

  return floorNames[floor] || `${floor}th`;
}

// ============================================================================
// Comparison Utilities
// ============================================================================

/**
 * Check if a QloApps room needs updating from PMS data
 * @param qloAppsRoom QloApps room
 * @param pmsRoom PMS room
 * @returns Whether update is needed and list of changes
 */
export function roomNeedsUpdate(
  qloAppsRoom: QloAppsRoom,
  pmsRoom: Room
): {
  needsUpdate: boolean;
  changes: string[];
} {
  const changes: string[] = [];

  // Compare room number
  if (qloAppsRoom.room_num !== pmsRoom.room_number) {
    changes.push(`room_num: ${qloAppsRoom.room_num} → ${pmsRoom.room_number}`);
  }

  // Compare status
  const qloAppsStatus = mapQloAppsStatusToPmsRoomStatus(qloAppsRoom.id_status);
  if (qloAppsStatus !== pmsRoom.status) {
    changes.push(`status: ${qloAppsStatus} → ${pmsRoom.status}`);
  }

  // Compare floor
  const qloAppsFloor = parseFloorString(qloAppsRoom.floor);
  if (qloAppsFloor !== pmsRoom.floor) {
    changes.push(`floor: ${qloAppsFloor} → ${pmsRoom.floor}`);
  }

  return {
    needsUpdate: changes.length > 0,
    changes,
  };
}

/**
 * Validate that a QloApps room has all required fields
 * @param room QloApps room
 * @returns Validation result
 */
export function validateQloAppsRoom(room: QloAppsRoom): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!room.id) {
    errors.push('Missing room ID');
  }

  if (!room.room_num) {
    errors.push('Missing room number');
  }

  if (!room.id_product) {
    errors.push('Missing product/room type ID');
  }

  if (!room.id_hotel) {
    errors.push('Missing hotel ID');
  }

  if (!room.id_status) {
    errors.push('Missing status ID');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

