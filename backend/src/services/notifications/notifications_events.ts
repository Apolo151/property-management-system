import {
  getUserIdsForHotelRoles,
  notifyUsersForHotel,
} from './notifications_service.js';

const HK_ROLES = ['HOUSEKEEPING', 'MANAGER', 'ADMIN', 'SUPER_ADMIN'];
const MAINT_ROLES = ['MAINTENANCE', 'MANAGER', 'ADMIN', 'SUPER_ADMIN'];

export async function notifyAfterCheckIn(
  hotelId: string,
  details: { id: string; reservation_id: string; actual_room_number: string },
): Promise<void> {
  const userIds = await getUserIdsForHotelRoles(hotelId, HK_ROLES);
  if (userIds.length === 0) return;
  await notifyUsersForHotel(
    hotelId,
    userIds,
    'HOUSEKEEPING_ALERT',
    'Guest checked in',
    `Room ${details.actual_room_number} is now occupied. Prepare for stay / future cleaning cycle.`,
    {
      dedupeKeyPrefix: `checkin-hk-${details.id}`,
      payload: {
        checkin_id: details.id,
        reservation_id: details.reservation_id,
        room_number: details.actual_room_number,
      },
    },
  );
}

export async function notifyAfterCheckOut(
  hotelId: string,
  details: { id: string; reservation_id: string; actual_room_number: string },
): Promise<void> {
  const userIds = await getUserIdsForHotelRoles(hotelId, HK_ROLES);
  if (userIds.length === 0) return;
  await notifyUsersForHotel(
    hotelId,
    userIds,
    'HOUSEKEEPING_ALERT',
    'Guest checked out — room needs cleaning',
    `Room ${details.actual_room_number} is in Cleaning status and housekeeping is Dirty.`,
    {
      dedupeKeyPrefix: `checkout-hk-${details.id}`,
      payload: {
        checkin_id: details.id,
        reservation_id: details.reservation_id,
        room_number: details.actual_room_number,
      },
    },
  );
}

export async function notifyMaintenanceCreated(
  hotelId: string,
  maintenanceId: string,
  title: string,
  roomNumber: string,
): Promise<void> {
  const userIds = await getUserIdsForHotelRoles(hotelId, MAINT_ROLES);
  if (userIds.length === 0) return;
  await notifyUsersForHotel(
    hotelId,
    userIds,
    'MAINTENANCE_ALERT',
    'New maintenance request',
    `${title} (Room ${roomNumber})`,
    {
      dedupeKeyPrefix: `maint-create-${maintenanceId}`,
      payload: { maintenance_id: maintenanceId, room_number: roomNumber },
    },
  );
}

export async function notifyHousekeepingRoomDirty(
  hotelId: string,
  roomId: string,
  roomNumber: string,
): Promise<void> {
  const userIds = await getUserIdsForHotelRoles(hotelId, HK_ROLES);
  if (userIds.length === 0) return;
  const day = new Date().toISOString().slice(0, 10);
  await notifyUsersForHotel(
    hotelId,
    userIds,
    'HOUSEKEEPING_ALERT',
    'Room marked dirty',
    `Room ${roomNumber} requires cleaning.`,
    {
      dedupeKeyPrefix: `hk-dirty-${roomId}-${day}`,
      payload: { room_id: roomId, room_number: roomNumber },
    },
  );
}
