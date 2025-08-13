"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import { ANALYTICS_ME, CLOCK_IN, CLOCK_OUT, LIST_LOCATIONS, ME, MY_SHIFTS } from "@/src/graphql/operations";
import { Button, Card, Col, Flex, Form, Input, Row, Space, Statistic, Table, Tag, Tooltip, message } from "antd";

function useGeolocation(enabled) {
  const [pos, setPos] = useState(null);
  const watchIdRef = useRef(null);
  useEffect(() => {
    if (!enabled) {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
      return;
    }
    if (!("geolocation" in navigator)) {
      message.error("Geolocation not supported");
      return;
    }
    watchIdRef.current = navigator.geolocation.watchPosition(
      (p) => setPos({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      (err) => console.warn("geo error", err),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
    return () => {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, [enabled]);
  return pos;
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export default function WorkerDashboard() {
  const { data: meData } = useQuery(ME);
  const { data: locData } = useQuery(LIST_LOCATIONS, { variables: { active: true }, fetchPolicy: "cache-and-network" });
  const { data: shiftsData, refetch: refetchShifts } = useQuery(MY_SHIFTS, { fetchPolicy: "network-only", pollInterval: 10000 });
  const { data: analyticsData, refetch: refetchAnalytics } = useQuery(ANALYTICS_ME, { variables: {} });

  const [clockIn] = useMutation(CLOCK_IN, { onCompleted: ()=>{ message.success("Clocked in"); refetchShifts(); refetchAnalytics(); } });
  const [clockOut] = useMutation(CLOCK_OUT, { onCompleted: ()=>{ message.success("Clocked out"); refetchShifts(); refetchAnalytics(); } });

  const activeLoc = useMemo(()=> (locData?.locations?.[0]) || null, [locData]);
  const openShift = useMemo(()=> (shiftsData?.shifts || []).find(s=>!s.clockOutAt) || null, [shiftsData]);

  const [tracking, setTracking] = useState(false);
  const [manualNote, setManualNote] = useState("");
  const pos = useGeolocation(tracking);

  // Auto clock in/out when entering/exiting perimeter
  const lastStatusRef = useRef(null); // inside|outside|null

  useEffect(() => {
    if (!tracking || !pos || !activeLoc) return;
    const distance = haversineKm(pos.lat, pos.lng, activeLoc.latitude, activeLoc.longitude);
    const inside = distance <= activeLoc.radiusKm + 1e-6;
    const prev = lastStatusRef.current;
    lastStatusRef.current = inside ? "inside" : "outside";

    // Entered perimeter -> auto clock in
    if (prev === "outside" && inside && !openShift) {
      clockIn({ variables: { note: "Auto clock-in", lat: pos.lat, lng: pos.lng } });
    }
    // Exited perimeter -> auto clock out
    if (prev === "inside" && !inside && openShift) {
      clockOut({ variables: { note: "Auto clock-out", lat: pos.lat, lng: pos.lng } });
    }
  }, [tracking, pos, activeLoc, openShift, clockIn, clockOut]);

  const doManualClock = useCallback((type) => {
    if (!pos) { message.warning("Waiting for location..."); return; }
    if (type === 'in' && openShift) { message.info("Already clocked in"); return; }
    if (type === 'out' && !openShift) { message.info("No active shift"); return; }
    if (type === 'in') clockIn({ variables: { note: manualNote || null, lat: pos.lat, lng: pos.lng, manualOverride: true } });
    if (type === 'out') clockOut({ variables: { note: manualNote || null, lat: pos.lat, lng: pos.lng, manualOverride: true } });
    setManualNote("");
  }, [pos, openShift, manualNote, clockIn, clockOut]);

  const columnsLogs = [
    { title: "Clock In", dataIndex: "clockInAt", render: (v)=>new Date(v).toLocaleString() },
    { title: "Clock Out", dataIndex: "clockOutAt", render: (v)=> v? new Date(v).toLocaleString(): <Tag color="green">Active</Tag> },
    { title: "In Note", dataIndex: "clockInNote" },
    { title: "Out Note", dataIndex: "clockOutNote" },
  ];

  const todayHours = useMemo(()=>{
    const today = new Date(); today.setHours(0,0,0,0);
    const a = (analyticsData?.analytics || []).find(x=> new Date(x.date).toDateString() === today.toDateString());
    return a?.totalHours || 0;
  }, [analyticsData]);

  return (
    <Flex vertical gap={16}>
      <Card>
        <Flex vertical gap={8}>
          <div className="text-lg font-semibold">Worker Dashboard</div>
          <div>
            Status: {openShift ? <Tag color="green">Clocked In</Tag> : <Tag>Clocked Out</Tag>}
            {pos && <span className="ml-3 text-xs text-gray-500">Lat {pos.lat.toFixed(5)}, Lng {pos.lng.toFixed(5)}</span>}
          </div>
          <Space>
            <Button type="primary" onClick={()=>setTracking((v)=>!v)}>{tracking?"Stop Location Tracking":"Start Location Tracking"}</Button>
            <Tooltip title="Override geofence checks">
              <Button onClick={()=>doManualClock('in')} disabled={!!openShift}>Manual Clock In</Button>
            </Tooltip>
            <Button danger onClick={()=>doManualClock('out')} disabled={!openShift}>Manual Clock Out</Button>
          </Space>
          <Input placeholder="Optional note" value={manualNote} onChange={(e)=>setManualNote(e.target.value)} />
        </Flex>
      </Card>

      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Card title="Today">
            <Statistic title="Hours" value={todayHours} precision={2} />
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="Logs">
            <Table size="small" rowKey="id" dataSource={shiftsData?.shifts || []} columns={columnsLogs} pagination={{ pageSize: 5 }} />
          </Card>
        </Col>
      </Row>
    </Flex>
  );
}
