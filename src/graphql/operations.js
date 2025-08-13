import { gql } from "graphql-tag";

export const ME = gql`
  query Me { me { id email name role } }
`;

export const LIST_LOCATIONS = gql`
  query Locations($active: Boolean) {
    locations(active: $active) { id name latitude longitude radiusKm active }
  }
`;

export const UPSERT_LOCATION = gql`
  mutation UpsertLocation($id: ID, $name: String, $latitude: Float!, $longitude: Float!, $radiusKm: Float!, $active: Boolean!) {
    upsertLocation(id: $id, name: $name, latitude: $latitude, longitude: $longitude, radiusKm: $radiusKm, active: $active) {
      id name latitude longitude radiusKm active
    }
  }
`;

export const SET_ACTIVE_LOCATION = gql`
  mutation SetActiveLocation($id: ID!) { setActiveLocation(id: $id) { id active } }
`;

export const CURRENTLY_CLOCKED_IN = gql`
  query CurrentlyClockedIn { currentlyClockedIn { id userId clockInAt clockInLat clockInLng } }
`;

export const USERS = gql`
  query Users($search: String) { users(search: $search) { id name email role } }
`;

export const DELETE_USER = gql`
  mutation DeleteUser($id: ID!) { deleteUser(id: $id) }
`;

export const PROMOTE_USER = gql`
  mutation PromoteUser($id: ID!, $role: Role!) { promoteUser(id: $id, role: $role) { id role } }
`;

export const DASHBOARD_STATS = gql`
  query DashboardStats {
    dashboardStats {
      avgHoursPerDayAll
      dailyClockInCounts { date count }
      weeklyHoursPerStaff { userId hours }
    }
  }
`;

export const CLOCK_IN = gql`
  mutation ClockIn($note: String, $lat: Float!, $lng: Float!, $manualOverride: Boolean) {
    clockIn(note: $note, lat: $lat, lng: $lng, manualOverride: $manualOverride) { id clockInAt }
  }
`;

export const CLOCK_OUT = gql`
  mutation ClockOut($note: String, $lat: Float!, $lng: Float!, $manualOverride: Boolean) {
    clockOut(note: $note, lat: $lat, lng: $lng, manualOverride: $manualOverride) { id clockOutAt }
  }
`;

export const MY_SHIFTS = gql`
  query MyShifts { shifts { id clockInAt clockOutAt clockInLat clockInLng clockOutLat clockOutLng clockInNote clockOutNote } }
`;

export const ANALYTICS_ME = gql`
  query AnalyticsMe($from: DateTime, $to: DateTime) { analytics(from: $from, to: $to) { id date totalHours shiftCount } }
`;
