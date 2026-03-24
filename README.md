# Kubernetes DevOps Platform

A full-stack DevOps monitoring platform built with a React + Vite frontend and a FastAPI backend, deployed on Azure.

## Live Demo

Frontend: https://agreeable-moss-0df902b0f.2.azurestaticapps.net  
Backend API: https://ca-devops-platform-api.mangobush-f9717141.eastus.azurecontainerapps.io

## Overview

This project demonstrates a cloud-native DevOps dashboard designed to visualize service health, request performance, traffic simulation, runtime metrics, and Kubernetes-style autoscaling behavior.

The platform is built to support two deployment models:

- **Low-cost cloud demo mode** using Azure Static Web Apps + Azure Container Apps
- **Kubernetes-ready mode** using manifests and runtime integration for AKS or another Kubernetes cluster

In the current Azure deployment, the backend runs in Azure Container Apps and the frontend runs in Azure Static Web Apps. Because this environment is not attached to a live Kubernetes cluster, the runtime panel falls back to **simulated Kubernetes data for demo purposes** while keeping the integration path intact for future AKS deployment.

## Architecture

```text
React + Vite frontend
        ↓
Azure Static Web Apps
        ↓
FastAPI backend
        ↓
Azure Container Apps
