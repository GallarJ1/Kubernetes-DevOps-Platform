from fastapi import FastAPI
import os
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from kubernetes import client, config
from kubernetes.config.config_exception import ConfigException
import time
import socket
import random

# Load Kubernetes configuration
try:
    config.load_incluster_config()
except ConfigException:
    #config.load_kube_config() not running kubernetes for demo
    pass


app = FastAPI(title="DevOps Control Center API")

allowed_origins = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in allowed_origins],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

start_time = time.time()

history_store = {
    "latency_points": [],
    "request_points": [],
    "cpu_points": [],
    "replica_points": [],
    "last_traffic_run": None,
}

metrics_store = {
    "total_requests": 0,
    "successful_requests": 0,
    "failed_requests": 0,
    "last_latency_ms": 0.0,
    "latency_history": [],
    "traffic_runs": 0,
}

def trim_history(points, max_items=50):
    if len(points) > max_items:
        del points[:-max_items]

def get_k8s_clients():
    try:
        config.load_incluster_config()
    except ConfigException:
        return None, None, None
    
    core_v1 = client.CoreV1Api()
    custom_api = client.CustomObjectsApi()
    autoscaling_api = client.AutoscalingV2Api()
    return core_v1, custom_api, autoscaling_api

class TrafficTestRequest(BaseModel):
    requests: int = Field(..., ge=1, le=500)
    delay_ms: int = Field(..., ge=0, le=5000)


def record_request(latency_ms: float, success: bool = True) -> None:
    metrics_store["total_requests"] = metrics_store.get("total_requests", 0) + 1
    metrics_store["last_latency_ms"] = round(latency_ms, 2)

    history = metrics_store.get("latency_history", [])
    history.append(latency_ms)
    if len(history) > 1000:
        history = history[-1000:]
    metrics_store["latency_history"] = history

    if success:
        metrics_store["successful_requests"] = metrics_store.get("successful_requests", 0) + 1
    else:
        metrics_store["failed_requests"] = metrics_store.get("failed_requests", 0) + 1
    
    timestamp = int(time.time())
    history_store["latency_points"].append({
    "timestamp": timestamp,
    "value": round(latency_ms, 2),
    })
    history_store["request_points"].append({
    "timestamp": timestamp,
    "value": metrics_store["total_requests"],
})
    trim_history(history_store["latency_points"])
    trim_history(history_store["request_points"])


def average_latency() -> float:
    history = metrics_store.get("latency_history", [])
    if not history:
        return 0.0
    return round(sum(history) / len(history), 2)


@app.get("/")
def root():
    return {
        "message": "DevOps Control Center API is running",
        "docs": "/docs",
    }


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "timestamp": int(time.time()),
    }


@app.get("/info")
def info():
    uptime_seconds = int(time.time() - start_time)

    return {
        "service": "DevOps Control Center API",
        "version": os.getenv("APP_VERSION", "1.0.0"),
        "environment": os.getenv("APP_ENV", "production"),
        "hostname": socket.gethostname(),
        "uptime_seconds": uptime_seconds,
        "build_id": os.getenv("BUILD_ID", "unknown"),
    }


@app.get("/request-test")
def request_test():
    request_start = time.perf_counter()
    simulated_delay = random.uniform(0.08, 0.35)
    time.sleep(simulated_delay)

    latency_ms = (time.perf_counter() - request_start) * 1000
    record_request(latency_ms, success=True)

    return {
        "message": "Test request completed successfully",
        "status_code": 200,
        "latency_ms": round(latency_ms, 2),
    }


@app.post("/traffic-test")
def traffic_test(payload: TrafficTestRequest):
    latencies = []
    successes = 0
    failures = 0

    for _ in range(payload.requests):
        request_start = time.perf_counter()

        simulated_processing = random.uniform(0.05, 0.25)
        time.sleep(simulated_processing)

        if payload.delay_ms > 0:
            time.sleep(payload.delay_ms / 1000)

        latency_ms = (time.perf_counter() - request_start) * 1000
        success = random.random() > 0.08

        record_request(latency_ms, success=success)
        latencies.append(latency_ms)

        if success:
            successes += 1
        else:
            failures += 1

    metrics_store["traffic_runs"] = metrics_store.get("traffic_runs", 0) + 1
    avg_latency_ms = round(sum(latencies) / len(latencies), 2) if latencies else 0.0
    history_store["last_traffic_run"] = {
    "timestamp": int(time.time()),
    "requested_runs": payload.requests,
    "successful_requests": successes,
    "failed_requests": failures,
    "avg_latency_ms": avg_latency_ms,
}

    return {
        "message": "Traffic simulation completed",
        "requested_runs": payload.requests,
        "successful_requests": successes,
        "failed_requests": failures,
        "avg_latency_ms": avg_latency_ms,
        "traffic_runs_total": metrics_store["traffic_runs"],
    }


@app.get("/metrics-summary")
def metrics_summary():
    uptime_seconds = int(time.time() - start_time)

    return {
        "total_requests": metrics_store.get("total_requests", 0),
        "successful_requests": metrics_store.get("successful_requests", 0),
        "failed_requests": metrics_store.get("failed_requests", 0),
        "avg_latency_ms": average_latency(),
        "last_latency_ms": metrics_store.get("last_latency_ms", 0),
        "traffic_runs": metrics_store.get("traffic_runs", 0),
        "uptime_seconds": uptime_seconds,
    }

@app.get("/k8s-runtime")
def k8s_runtime():
    namespace = "default"
    label_selector = "app=devops-platform-api"

    core_v1, custom_api, autoscaling_api = get_k8s_clients()
    if not core_v1 or not custom_api or not autoscaling_api:
        timestamp = int(time.time())

        demo_pods = [
            {
                "name": "devops-platform-api-7c9d8f6b6b-2k4lm",
                "status": "Running",
                "cpu_millicores": 78,
                "memory_mib": 186,
            },
            {
                "name": "devops-platform-api-7c9d8f6b6b-8p9qx",
                "status": "Running",
                "cpu_millicores": 64,
                "memory_mib": 171,
            },
            {
                "name": "devops-platform-api-7c9d8f6b6b-x4nzt",
                "status": "Running",
                "cpu_millicores": 91,
                "memory_mib": 214,
            },
        ]

        total_cpu_millicores = sum(p["cpu_millicores"] for p in demo_pods)
        total_memory_mib = sum(p["memory_mib"] for p in demo_pods)

        demo_hpa = {
            "min_replicas": 2,
            "max_replicas": 6,
            "current_replicas": 3,
            "desired_replicas": 3,
        }

        history_store["cpu_points"].append({
            "timestamp": timestamp,
            "value": round(total_cpu_millicores, 2),
        })
        history_store["replica_points"].append({
            "timestamp": timestamp,
            "value": len(demo_pods),
        })
        trim_history(history_store["cpu_points"])
        trim_history(history_store["replica_points"])

        return {
            "cluster_connected": False,
            "demo_mode": True,
            "message": "Live Kubernetes cluster not attached in this Container Apps deployment. Showing simulated runtime data for demo purposes.",
            "connection_note": "Kubernetes runtime integration is implemented and will return live cluster data when deployed inside AKS or another Kubernetes cluster with in-cluster config available.",
            "namespace": namespace,
            "replica_count": len(demo_pods),
            "total_cpu_millicores": round(total_cpu_millicores, 2),
            "total_memory_mib": round(total_memory_mib, 2),
            "pods": demo_pods,
            "hpa": demo_hpa,
        }

    pods = core_v1.list_namespaced_pod(
        namespace=namespace,
        label_selector=label_selector
    ).items

    pod_data = []
    total_cpu_millicores = 0
    total_memory_mib = 0

    try:
        metrics = custom_api.list_namespaced_custom_object(
            group="metrics.k8s.io",
            version="v1beta1",
            namespace=namespace,
            plural="pods"
        )
        metrics_map = {
            item["metadata"]["name"]: item
            for item in metrics.get("items", [])
        }
    except Exception:
        metrics_map = {}

    for pod in pods:
        pod_name = pod.metadata.name
        pod_status = pod.status.phase
        cpu_m = 0
        mem_mib = 0

        metric_entry = metrics_map.get(pod_name)
        if metric_entry:
            for container in metric_entry.get("containers", []):
                cpu_raw = container["usage"].get("cpu", "0m")
                mem_raw = container["usage"].get("memory", "0Mi")

                if cpu_raw.endswith("m"):
                    cpu_m += int(cpu_raw[:-1])
                elif cpu_raw.endswith("n"):
                    cpu_m += int(cpu_raw[:-1]) / 1_000_000
                else:
                    cpu_m += int(cpu_raw)

                if mem_raw.endswith("Ki"):
                    mem_mib += int(mem_raw[:-2]) / 1024
                elif mem_raw.endswith("Mi"):
                    mem_mib += int(mem_raw[:-2])
                elif mem_raw.endswith("Gi"):
                    mem_mib += int(mem_raw[:-2]) * 1024

        total_cpu_millicores += cpu_m
        total_memory_mib += mem_mib

        pod_data.append({
            "name": pod_name,
            "status": pod_status,
            "cpu_millicores": round(cpu_m, 2),
            "memory_mib": round(mem_mib, 2),
        })

    hpa_info = None
    try:
        hpa = autoscaling_api.read_namespaced_horizontal_pod_autoscaler(
            name="devops-platform-api",
            namespace=namespace
        )
        hpa_info = {
            "min_replicas": hpa.spec.min_replicas,
            "max_replicas": hpa.spec.max_replicas,
            "current_replicas": hpa.status.current_replicas,
            "desired_replicas": hpa.status.desired_replicas,
        }
    except Exception:
        hpa_info = None

    timestamp = int(time.time())
    history_store["cpu_points"].append({
        "timestamp": timestamp,
        "value": round(total_cpu_millicores, 2),
    })
    history_store["replica_points"].append({
        "timestamp": timestamp,
        "value": len(pod_data),
    })
    trim_history(history_store["cpu_points"])
    trim_history(history_store["replica_points"])

    return {
        "cluster_connected": True,
        "demo_mode": False,
        "message": "Live Kubernetes runtime data retrieved successfully.",
        "namespace": namespace,
        "replica_count": len(pod_data),
        "total_cpu_millicores": round(total_cpu_millicores, 2),
        "total_memory_mib": round(total_memory_mib, 2),
        "pods": pod_data,
        "hpa": hpa_info,
    }

@app.get("/metrics-history")
def metrics_history():
    return history_store


@app.get("/platform-summary")
def platform_summary():
    total_requests = metrics_store.get("total_requests", 0)
    successful_requests = metrics_store.get("successful_requests", 0)
    failed_requests = metrics_store.get("failed_requests", 0)

    success_rate = round((successful_requests / total_requests) * 100, 2) if total_requests else 0.0
    failure_rate = round((failed_requests / total_requests) * 100, 2) if total_requests else 0.0

    core_v1, custom_api, autoscaling_api = get_k8s_clients()
    replica_count = 0
    total_cpu_millicores = 0
    total_memory_mib = 0

    if core_v1 and custom_api:
        try:
            runtime = k8s_runtime()
            replica_count = runtime.get("replica_count", 0)
            total_cpu_millicores = runtime.get("total_cpu_millicores", 0)
            total_memory_mib = runtime.get("total_memory_mib", 0)
        except Exception:
            pass

    return {
        "health": "healthy",
        "total_requests": total_requests,
        "successful_requests": successful_requests,
        "failed_requests": failed_requests,
        "success_rate": success_rate,
        "failure_rate": failure_rate,
        "avg_latency_ms": average_latency(),
        "last_latency_ms": metrics_store.get("last_latency_ms", 0),
        "replica_count": replica_count,
        "total_cpu_millicores": total_cpu_millicores,
        "total_memory_mib": total_memory_mib,
        "last_traffic_run": history_store.get("last_traffic_run"),
    }