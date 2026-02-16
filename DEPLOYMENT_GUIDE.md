# LLMShield Deployment Guide

This guide will walk you through deploying your project for **FREE** using **Vercel** (Frontend) and **Azure for Students** (Backend).

---

## 1. Professional Vercel Account Setup (Free)

Vercel is the industry standard for React apps. Follow these steps to create your free "Hobby" account:

1. **Sign Up**: Go to [vercel.com/signup](https://vercel.com/signup).
2. **Choose Identity**: Select **"Continue with GitHub"**. This is crucial because it allows Vercel to automatically deploy your project whenever you push code.
3. **Account Type**: Choose **"Hobby"** (Personal account). It is free forever for non-commercial projects like your FYP.
4. **Authorization**: Grant Vercel access to your GitHub repositories.
5. **Verify**: You might need to verify your email address.

---

## 2. Prepare for Deployment

Before deploying, ensure your project is clean and environment variables are ready.

### Check Backend
- Your `backend/Dockerfile` is already configured to work with Azure Container Apps or App Service.
- Ensure you have a **MongoDB Atlas** account (Free tier) because Azure containers cannot reach a "localhost" database.

### Check Frontend
- The `frontend/Dockerfile` I added is for containerized local testing, but Vercel will use its own build system.

---

## 3. Deploy Frontend to Vercel

1. **Dashboard**: Go to your [Vercel Dashboard](https://vercel.com/dashboard).
2. **New Project**: Click **"Add New"** -> **"Project"**.
3. **Import**: Find your `FYP-LLMShield` repository and click **"Import"**.
4. **Configure**:
   - **Framework Preset**: Should automatically detect **"Create React App"**.
   - **Root Directory**: Select `frontend`.
   - **Environment Variables**: Add the following (you will update these AFTER deploying the backend):
     - `REACT_APP_API_URL`: (Temporary placeholder, e.g., `https://temp.azurewebsites.net/api/v1`)
     - `REACT_APP_API_BASE_URL`: (Temporary placeholder, e.g., `https://temp.azurewebsites.net`)
5. **Deploy**: Click **"Deploy"**. Vercel will build and give you a URL (e.g., `https://fyp-llmshield.vercel.app`).

---

## 4. Deploy Backend to Azure (Student Free)

You already have an active student account. Follow the detailed steps in [backend/DEPLOYMENT.md](file:///c:/Alisha/Projects/university/fyp/FYP-LLMShield/backend/DEPLOYMENT.md).

**Key Steps summarized:**
1. Log in via Azure CLI: `az login`.
2. Push your backend to **Azure Container Registry (ACR)** or **Docker Hub**.
3. Create an **Azure App Service** (Web App for Containers) using the **Free F1** tier.
4. Set **Application Settings** in Azure Portal:
   - `WEBSITES_PORT`: `8000`
   - `MONGODB_URL`: Your Atlas connection string.
   - `BACKEND_CORS_ORIGINS`: Your Vercel URL (e.g., `https://fyp-llmshield.vercel.app`).

---

## 5. Connect Everything

1. **Copy Backend URL**: Once Azure finishes deploying, copy your backend URL (e.g., `https://llmshield-backend.azurewebsites.net`).
2. **Update Vercel**: 
   - Go back to Vercel -> Settings -> Environment Variables.
   - Update `REACT_APP_API_URL` to your real backend URL + `/api/v1`.
   - Update `REACT_APP_API_BASE_URL` to your real backend URL.
3. **Redeploy**: Click the **"Redeploy"** button in Vercel to pick up the new variables.

---

## Summary Checklist

- [ ] Vercel account created with GitHub.
- [ ] Frontend deployed to Vercel (pointing to `frontend` folder).
- [ ] Backend deployed to Azure (using Free F1 tier).
- [ ] MongoDB Atlas string added to Azure.
- [ ] Vercel URL added to Azure's `BACKEND_CORS_ORIGINS`.
- [ ] Backend URL added to Vercel's environment variables.
