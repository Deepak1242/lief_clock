"use client";
import { useQuery, useMutation } from "@apollo/client";
import { Button, Card, Col, Flex, Form, Input, InputNumber, Row, Table, Typography, message } from "antd";
import { CURRENTLY_CLOCKED_IN, LIST_LOCATIONS, SET_ACTIVE_LOCATION, UPSERT_LOCATION, USERS, DELETE_USER, PROMOTE_USER, DASHBOARD_STATS } from "@/src/graphql/operations";
import { useEffect, useMemo, useState } from "react";
import { Line } from "react-chartjs-2";
import { Chart as ChartJS, LineElement, CategoryScale, LinearScale, PointElement, Tooltip, Legend } from "chart.js";
ChartJS.register(LineElement, CategoryScale, LinearScale, PointElement, Tooltip, Legend);

export default function AdminDashboard() {
  const [form] = Form.useForm();
  const { data: locData, refetch: refetchLocs } = useQuery(LIST_LOCATIONS);
  const { data: clockedData, startPolling, stopPolling } = useQuery(CURRENTLY_CLOCKED_IN, { pollInterval: 0 });
  const { data: usersData, refetch: refetchUsers } = useQuery(USERS, { variables: { search: "" } });
  const { data: statsData } = useQuery(DASHBOARD_STATS);

  useEffect(() => {
    startPolling(5000);
    return () => stopPolling();
  }, [startPolling, stopPolling]);

  const [upsertLocation, { loading: savingLoc }] = useMutation(UPSERT_LOCATION, {
    onCompleted: () => { message.success("Location saved"); refetchLocs(); },
  });
  const [setActiveLocation, { loading: settingActive }] = useMutation(SET_ACTIVE_LOCATION, {
    onCompleted: () => { message.success("Active location set"); refetchLocs(); },
  });
  const [deleteUser] = useMutation(DELETE_USER, { onCompleted: () => { message.success("User removed"); refetchUsers(); } });
  const [promoteUser] = useMutation(PROMOTE_USER, { onCompleted: () => { message.success("Role updated"); refetchUsers(); } });

  const activeLoc = useMemo(() => locData?.locations?.find(l => l.active) || null, [locData]);

  const onFinish = (values) => {
    upsertLocation({ variables: { ...values, active: true } });
  };

  const columnsClocked = [
    { title: "User ID", dataIndex: "userId", key: "userId" },
    { title: "Clock In", dataIndex: "clockInAt", key: "clockInAt", render: (v)=> new Date(v).toLocaleString() },
    { title: "Lat", dataIndex: "clockInLat", key: "clockInLat" },
    { title: "Lng", dataIndex: "clockInLng", key: "clockInLng" },
  ];

  const columnsUsers = [
    { title: "Name", dataIndex: "name", key: "name" },
    { title: "Email", dataIndex: "email", key: "email" },
    { title: "Role", dataIndex: "role", key: "role" },
    { title: "Actions", key: "actions", render: (_, r) => (
      <Flex gap={8}>
        <Button onClick={()=>promoteUser({ variables: { id: r.id, role: r.role === 'ADMIN' ? 'CAREWORKER' : 'ADMIN' } })}>{r.role==='ADMIN'?'Make Worker':'Make Admin'}</Button>
        <Button danger onClick={()=>deleteUser({ variables: { id: r.id } })}>Remove</Button>
      </Flex>
    )},
  ];

  const dailyCounts = statsData?.dashboardStats?.dailyClockInCounts || [];
  const chartData = {
    labels: dailyCounts.map(d=>d.date),
    datasets: [{ label: 'Daily Clock-ins', data: dailyCounts.map(d=>d.count), borderColor: '#1677ff', fill: false }]
  };

  return (
    <Flex vertical gap={16}>
      <Typography.Title level={3}>Admin Dashboard</Typography.Title>

      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Card title="Set Geofence Location">
            <Form form={form} layout="vertical" onFinish={onFinish} initialValues={activeLoc || { radiusKm: 0.25 }}>
              <Form.Item label="Name" name="name"><Input placeholder="Hospital A" /></Form.Item>
              <Form.Item label="Latitude" name="latitude" rules={[{ required: true }]}><InputNumber style={{width:'100%'}} /></Form.Item>
              <Form.Item label="Longitude" name="longitude" rules={[{ required: true }]}><InputNumber style={{width:'100%'}} /></Form.Item>
              <Form.Item label="Radius (km)" name="radiusKm" rules={[{ required: true }]}><InputNumber min={0.05} step={0.05} style={{width:'100%'}} /></Form.Item>
              <Flex gap={8}>
                <Button type="primary" htmlType="submit" loading={savingLoc}>Save & Activate</Button>
                {activeLoc && <Button loading={settingActive} onClick={()=>setActiveLocation({ variables: { id: activeLoc.id } })}>Re-Activate Current</Button>}
              </Flex>
            </Form>
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="Currently Clocked In">
            <Table size="small" rowKey="id" dataSource={clockedData?.currentlyClockedIn || []} columns={columnsClocked} pagination={{ pageSize: 5 }} />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Card title="Daily Clock-ins">
            <Line data={chartData} />
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="Employees">
            <Table size="small" rowKey="id" dataSource={usersData?.users || []} columns={columnsUsers} />
          </Card>
        </Col>
      </Row>
    </Flex>
  );
}
