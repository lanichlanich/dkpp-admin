"use client";
import { createContext, useContext } from "react";
import type { AccessUser } from "@/lib/access-control";
export const AccessContext = createContext<AccessUser>({ isAdministrator: false, menuPermissions: [] });
export const useAccess = () => useContext(AccessContext);
