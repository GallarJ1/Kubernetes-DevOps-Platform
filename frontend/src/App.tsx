import { useEffect, useState } from "react";
import axios from "axios";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import "./App.css";

const API = import.meta.env.VITE_API_BASE_URL || "";
type HealthResponse = {
  status: string;
  timestamp: number;
};

type InfoResponse = {
  service: string;
  version: string;
  environment: string;
  hostname: string;
  uptime_seconds: number;
  build_id: string;
};

type RequestTestResponse = {
  message: string;
  status_code: number;
  latency_ms: number;
};

type TrafficTestResponse = {
  message: string;
  requested_runs: number;
  successful_requests: number;
  failed_requests: number;
  avg_latency_ms: number;
  traffic_runs_total: number;
};

type MetricsResponse = {
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  avg_latency_ms: number;
  last_latency_ms: number;
  traffic_runs: number;
  uptime_seconds: number;
};

type K8sRuntimeResponse = {
  cluster_connected: boolean;
  demo_mode?: boolean;
  connection_note?: string;
  namespace: string;
  replica_count: number;
  total_cpu_millicores: number;
  total_memory_mib: number;
  pods: {
    name: string;
    status: string;
    cpu_millicores: number;
    memory_mib: number;
  }[];
  hpa: {
    min_replicas: number;
    max_replicas: number;
    current_replicas: number;
    desired_replicas: number;
  } | null;
  message?: string;
};

type HistoryPoint = {
  timestamp: number;
  value: number;
};

type MetricsHistoryResponse = {
  latency_points: HistoryPoint[];
  request_points: HistoryPoint[];
  cpu_points: HistoryPoint[];
  replica_points: HistoryPoint[];
  last_traffic_run: {
    timestamp: number;
    requested_runs: number;
    successful_requests: number;
    failed_requests: number;
    avg_latency_ms: number;
  } | null;
};

type PlatformSummaryResponse = {
  health: string;
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  success_rate: number;
  failure_rate: number;
  avg_latency_ms: number;
  last_latency_ms: number;
  replica_count: number;
  total_cpu_millicores: number;
  total_memory_mib: number;
  last_traffic_run: {
    timestamp: number;
    requested_runs: number;
    successful_requests: number;
    failed_requests: number;
    avg_latency_ms: number;
  } | null;
};

function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [info, setInfo] = useState<InfoResponse | null>(null);
  const [testResponse, setTestResponse] = useState<RequestTestResponse | null>(null);
  const [trafficResponse, setTrafficResponse] = useState<TrafficTestResponse | null>(null);
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [k8sRuntime, setK8sRuntime] = useState<K8sRuntimeResponse | null>(null);
  const [metricsHistory, setMetricsHistory] = useState<MetricsHistoryResponse | null>(null);
  const [platformSummary, setPlatformSummary] = useState<PlatformSummaryResponse | null>(null);
  const [activityLog, setActivityLog] = useState<string[]>([]);
  const [apiStatus, setApiStatus] = useState<"waking" | "online" | "offline">("waking");
  const [bootMessage, setBootMessage] = useState("Waking Azure Container Apps demo runtime...");


  const [trafficRequests, setTrafficRequests] = useState(25);
  const [trafficDelay, setTrafficDelay] = useState(100);
  const [trafficLoading, setTrafficLoading] = useState(false);

  const formatTime = (timestamp: number) =>
    new Date(timestamp * 1000).toLocaleTimeString();

  const getHealth = async () => {
  try {
    const res = await axios.get<HealthResponse>(`${API}/health`, {
      timeout: 10000,
    });

    setHealth(res.data);
    setApiStatus("online");
    setBootMessage("Demo runtime online.");
  } catch (error) {
    setApiStatus("waking");
    setBootMessage("Demo runtime is starting up. This can take 1–2 minutes on the free/cost-saving Azure tier.");
    console.error("Health check failed:", error);
  }
};

  const getInfo = async () => {
    const res = await axios.get<InfoResponse>(`${API}/info`);
    setInfo(res.data);
  };

  const getMetrics = async () => {
    const res = await axios.get<MetricsResponse>(`${API}/metrics-summary`);
    setMetrics(res.data);
  };

  const getK8sRuntime = async () => {
    try {
      const res = await axios.get<K8sRuntimeResponse>(`${API}/k8s-runtime`);
      setK8sRuntime(res.data);
    } catch (error) {
      console.error("K8s runtime fetch failed:", error);
    }
  };

  const getMetricsHistory = async () => {
    try {
      const res = await axios.get<MetricsHistoryResponse>(`${API}/metrics-history`);
      setMetricsHistory(res.data);
    } catch (error) {
      console.error("Metrics history fetch failed:", error);
    }
  };

  const getPlatformSummary = async () => {
    try {
      const res = await axios.get<PlatformSummaryResponse>(`${API}/platform-summary`);
      setPlatformSummary(res.data);
    } catch (error) {
      console.error("Platform summary fetch failed:", error);
    }
  };

  const sendTestRequest = async () => {
    try {
      const res = await axios.get<RequestTestResponse>(`${API}/request-test`);
      setTestResponse(res.data);
      await getMetrics();
      await getK8sRuntime();
      await getMetricsHistory();
      await getPlatformSummary();
    } catch (error) {
      console.error("Request test failed:", error);
    }
  };

  const runTrafficTest = async () => {
    setTrafficLoading(true);
    try {
      const res = await axios.post<TrafficTestResponse>(`${API}/traffic-test`, {
        requests: trafficRequests,
        delay_ms: trafficDelay,
      });
      setTrafficResponse(res.data);
      await getMetrics();
      await getK8sRuntime();
      await getMetricsHistory();
      await getPlatformSummary();
    } catch (error) {
      console.error("Traffic test failed:", error);
    } finally {
      setTrafficLoading(false);
    }
  };

  useEffect(() => {
    getHealth();
    getInfo();
    getMetrics();
    getK8sRuntime();
    getMetricsHistory();
    getPlatformSummary();

    const interval = setInterval(() => {
      getHealth();
      getMetrics();
      getK8sRuntime();
      getMetricsHistory();
      getPlatformSummary();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!platformSummary || !metricsHistory) return;

    const log: string[] = [];

    log.push(
      `[${new Date().toLocaleTimeString()}] Health status: ${platformSummary.health}`
    );

    log.push(
      `[${new Date().toLocaleTimeString()}] Replicas: ${platformSummary.replica_count}, CPU: ${platformSummary.total_cpu_millicores}m, Memory: ${platformSummary.total_memory_mib}Mi`
    );

    if (platformSummary.last_traffic_run) {
      log.push(
        `[${formatTime(
          platformSummary.last_traffic_run.timestamp
        )}] Traffic test ran: ${platformSummary.last_traffic_run.requested_runs} requests, avg latency ${platformSummary.last_traffic_run.avg_latency_ms} ms`
      );
    }

    if (k8sRuntime?.demo_mode) {
  log.push(
    `[${new Date().toLocaleTimeString()}] Kubernetes runtime is running in demo mode with simulated pod and autoscaling data.`
  );
}

    setActivityLog(log);
  }, [platformSummary, metricsHistory, k8sRuntime]);

  return (
    <div className="container"
       style={{
      boxShadow:
        (platformSummary?.total_cpu_millicores ?? 0) > 500
          ? "0 0 40px rgba(239, 68, 68, 0.2)"
          : "0 0 20px rgba(34, 197, 94, 0.1)",
      }}
      >
      <header className="hero">
        <h1>DevOps Control Center</h1>
        <div className="live-indicator">
          <span className="pulse"></span>
            {apiStatus === "online"
            ? `Live API | ${k8sRuntime?.demo_mode ? "Demo Runtime" : "K8s Runtime"}`
            : "Live Frontend | Waking Demo Runtime..."}
        </div>
        <p>
          Interactive frontend for service health, deployment data, request
          testing, runtime metrics, and Kubernetes autoscaling visibility.
        </p>

        {apiStatus !== "online" && (
        <div className="warmup-banner">
        <strong>Starting demo runtime...</strong>
        <span>{bootMessage}</span>
        <span className="warmup-subtext">
          The frontend loaded successfully. The backend may need a short cold-start before the dashboard becomes interactive.
        </span>
      </div>
      )}  
      </header>

      <section className="grid two">
        <div className="panel">
          <h2>Service Health</h2>
          <div className="status-row">
            <span className={`badge ${health?.status === "healthy" ? "ok" : "bad"}`}>
              {health?.status ?? "unknown"}
            </span>
            <button onClick={getHealth}>Refresh</button>
          </div>
          <p>
            <strong>Last Check:</strong>{" "}
            {health ? new Date(health.timestamp * 1000).toLocaleString() : "—"}
          </p>
        </div>

        <div className="panel">
          <h2>Deployment Info</h2>
          <p><strong>Service:</strong> {info?.service ?? "—"}</p>
          <p><strong>Version:</strong> {info?.version ?? "—"}</p>
          <p><strong>Environment:</strong> {info?.environment ?? "—"}</p>
          <p><strong>Hostname:</strong> {info?.hostname ?? "—"}</p>
          <p><strong>Build ID:</strong> {info?.build_id ?? "—"}</p>
          <p><strong>Uptime:</strong> {info?.uptime_seconds ?? 0}s</p>
        </div>
      </section>

      <section className="grid two">
        <div className="panel">
          <h2>Request Tester</h2>
          <button onClick={sendTestRequest}>Send Test Request</button>
          <div className="result-box">
            <p><strong>Message:</strong> {testResponse?.message ?? "No request sent yet."}</p>
            <p><strong>Status Code:</strong> {testResponse?.status_code ?? "—"}</p>
            <p><strong>Latency:</strong> {testResponse?.latency_ms ?? "—"} ms</p>
          </div>
        </div>

        <div className="panel">
          <h2>Traffic Simulator</h2>
          <div className="form-row">
            <label>
              Requests
              <input
                type="number"
                min={1}
                max={500}
                value={trafficRequests}
                onChange={(e) => setTrafficRequests(Number(e.target.value))}
              />
            </label>
            <label>
              Delay (ms)
              <input
                type="number"
                min={0}
                max={5000}
                value={trafficDelay}
                onChange={(e) => setTrafficDelay(Number(e.target.value))}
              />
            </label>
          </div>
          <button onClick={runTrafficTest} disabled={trafficLoading}>
            {trafficLoading ? "Running..." : "Run Traffic Test"}
          </button>
          <div className="result-box">
            <p><strong>Message:</strong> {trafficResponse?.message ?? "No traffic test run yet."}</p>
            <p><strong>Requested Runs:</strong> {trafficResponse?.requested_runs ?? "—"}</p>
            <p><strong>Successful:</strong> {trafficResponse?.successful_requests ?? "—"}</p>
            <p><strong>Failed:</strong> {trafficResponse?.failed_requests ?? "—"}</p>
            <p><strong>Avg Latency:</strong> {trafficResponse?.avg_latency_ms ?? "—"} ms</p>
          </div>
        </div>
      </section>

      <section className="panel">
        <h2>Metrics Overview</h2>
        <div className="stats-grid">
          <div className="stat-card">
            <span>Total Requests</span>
            <strong>{metrics?.total_requests ?? 0}</strong>
          </div>
          <div className="stat-card">
            <span>Successful</span>
            <strong>{metrics?.successful_requests ?? 0}</strong>
          </div>
          <div className="stat-card">
            <span>Failed</span>
            <strong>{metrics?.failed_requests ?? 0}</strong>
          </div>
          <div className="stat-card">
            <span>Avg Latency</span>
            <strong>{metrics?.avg_latency_ms ?? 0} ms</strong>
          </div>
          <div className="stat-card">
            <span>Last Latency</span>
            <strong>{metrics?.last_latency_ms ?? 0} ms</strong>
          </div>
          <div className="stat-card">
            <span>Traffic Runs</span>
            <strong>{metrics?.traffic_runs ?? 0}</strong>
          </div>
        </div>
      </section>

      <section className="panel">
  <h2>Kubernetes Runtime</h2>

  {k8sRuntime?.demo_mode && (
    <div className="demo-badge">
      ⚠ Demo Mode (Simulated Kubernetes Data)
    </div>
  )}

  <div className="result-box">
    <p>
      <strong>Status:</strong>{" "}
      {k8sRuntime?.cluster_connected ? "Connected" : "Not connected"}
    </p>

    <p>
      {k8sRuntime?.cluster_connected
        ? "Live Kubernetes cluster connected."
        : "Running in demo mode: This deployment is hosted on Azure Container Apps. Kubernetes runtime data is simulated."}
    </p>

    {!k8sRuntime?.cluster_connected && (
      <p>
        Kubernetes runtime integration is fully implemented and will return live
        cluster data when deployed inside AKS or another Kubernetes cluster with
        in-cluster config available.
      </p>
    )}
  </div>

  {(k8sRuntime?.cluster_connected || k8sRuntime?.demo_mode) && (
    <>
      <div className="stats-grid">
        <div className="stat-card">
          <span>Replicas</span>
          <strong>{k8sRuntime?.replica_count ?? 0}</strong>
        </div>
        <div className="stat-card">
          <span>Total CPU</span>
          <strong>{k8sRuntime?.total_cpu_millicores ?? 0} m</strong>
        </div>
        <div className="stat-card">
          <span>Total Memory</span>
          <strong>{k8sRuntime?.total_memory_mib ?? 0} Mi</strong>
        </div>
        <div className="stat-card">
          <span>HPA Current</span>
          <strong>{k8sRuntime?.hpa?.current_replicas ?? 0}</strong>
        </div>
        <div className="stat-card">
          <span>HPA Desired</span>
          <strong>{k8sRuntime?.hpa?.desired_replicas ?? 0}</strong>
        </div>
        <div className="stat-card">
          <span>HPA Range</span>
          <strong>
            {k8sRuntime?.hpa
              ? `${k8sRuntime.hpa.min_replicas}-${k8sRuntime.hpa.max_replicas}`
              : "—"}
          </strong>
        </div>
      </div>

      <div className="result-box runtime-box">
        <h3>
          Pod Details{" "}
          {k8sRuntime?.demo_mode
            ? "(Simulated for Demo)"
            : "(Live Cluster Data)"}
        </h3>

        {k8sRuntime?.pods?.length ? (
          <div className="pod-list">
            {k8sRuntime.pods.map((pod) => (
              <div key={pod.name} className="pod-card">
                <p>
                  <strong>{pod.name}</strong>
                </p>
                <p>Status: {pod.status}</p>
                <p>CPU: {pod.cpu_millicores} m</p>
                <p>Memory: {pod.memory_mib} Mi</p>
              </div>
            ))}
          </div>
        ) : (
          <p>No pod data available.</p>
        )}
      </div>
    </>
  )}
  </section>

      <section className="panel">
        <h2>Live Platform Trends</h2>
        <div className="chart-grid">
          <div className="chart-card">
            <h3>Latency</h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={metricsHistory?.latency_points ?? []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={(value) => formatTime(Number(value))}
                  minTickGap={20}
                />
                <YAxis />
                <Tooltip labelFormatter={(value) => formatTime(Number(value))} />
                <Line type="monotone" dataKey="value" stroke="#22c55e" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-card">
            <h3>CPU Usage</h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={metricsHistory?.cpu_points ?? []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={(value) => formatTime(Number(value))}
                  minTickGap={20}
                />
                <YAxis />
                <Tooltip labelFormatter={(value) => formatTime(Number(value))} />
                <Line type="monotone" dataKey="value" stroke="#38bdf8" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-card">
            <h3>Replica Count</h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={metricsHistory?.replica_points ?? []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={(value) => formatTime(Number(value))}
                  minTickGap={20}
                />
                <YAxis allowDecimals={false} />
                <Tooltip labelFormatter={(value) => formatTime(Number(value))} />
                <Line type="monotone" dataKey="value" stroke="#f59e0b" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="grid two">
        <div className="panel">
          <h2>Platform Summary</h2>
          <div className="stats-grid">
            <div className="stat-card">
              <span>Success Rate</span>
              <strong>{platformSummary?.success_rate ?? 0}%</strong>
            </div>
            <div className="stat-card">
              <span>Failure Rate</span>
              <strong>{platformSummary?.failure_rate ?? 0}%</strong>
            </div>
            <div className="stat-card">
              <span>CPU Total</span>
              <strong>{platformSummary?.total_cpu_millicores ?? 0} m</strong>
            </div>
            <div className="stat-card">
              <span>Memory Total</span>
              <strong>{platformSummary?.total_memory_mib ?? 0} Mi</strong>
            </div>
            <div className="stat-card">
              <span>Replicas</span>
              <strong>{platformSummary?.replica_count ?? 0}</strong>
            </div>
            <div className="stat-card">
              <span>Health</span>
              <strong>{platformSummary?.health ?? "unknown"}</strong>
            </div>
          </div>

          {k8sRuntime?.hpa &&
            k8sRuntime.hpa.desired_replicas > k8sRuntime.hpa.current_replicas && (
              <div className="scaling-banner">
                Scaling Up: {k8sRuntime.hpa.current_replicas} → {k8sRuntime.hpa.desired_replicas}
              </div>
            )}
        </div>

        <div className="panel">
          <h2>Live Activity</h2>
          <div className="activity-log">
            {activityLog.length ? (
              activityLog.map((entry, index) => (
                <div key={index} className="activity-entry">
                  {entry}
                </div>
              ))
            ) : (
              <div className="activity-entry">No recent activity.</div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

export default App;