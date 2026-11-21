import { useCallback, useState } from 'react';
import { isAdminOrTi, type Profile, type Warehouse } from '../types/pos';
import {
  getDemoWarehouses,
  getStoredProfile,
  signInAsDemoProfile,
  signInLocal,
  signOutLocal,
} from '../services/localPosService';

const ACTIVE_WAREHOUSE_KEY = 'pos-ventas-active-warehouse-v2';

function resolveInitialWarehouseId(profile: Profile | null, warehouses: Warehouse[]): string | null {
  if (!profile) return null;
  if (isAdminOrTi(profile.role)) {
    const saved = localStorage.getItem(ACTIVE_WAREHOUSE_KEY);
    if (saved && warehouses.some((w) => w.id === saved)) return saved;
    if (
      profile.assigned_warehouse_id &&
      warehouses.some((w) => w.id === profile.assigned_warehouse_id)
    ) {
      return profile.assigned_warehouse_id;
    }
    return warehouses[0]?.id ?? null;
  }
  return profile.assigned_warehouse_id;
}

export function useAuth() {
  const warehouses = getDemoWarehouses();
  const [profile, setProfile] = useState<Profile | null>(() => getStoredProfile());
  const [activeWarehouseId, setActiveWarehouseId] = useState<string | null>(() =>
    resolveInitialWarehouseId(getStoredProfile(), warehouses)
  );

  const applyProfile = useCallback(
    (nextProfile: Profile) => {
      setProfile(nextProfile);
      setActiveWarehouseId(resolveInitialWarehouseId(nextProfile, warehouses));
    },
    [warehouses]
  );

  const signIn = async (email: string, password: string) => {
    const logged = signInLocal(email, password);
    applyProfile(logged);
  };

  const signInDemo = (profileId: string) => {
    const logged = signInAsDemoProfile(profileId);
    applyProfile(logged);
  };

  const signOut = async () => {
    signOutLocal();
    setProfile(null);
    setActiveWarehouseId(null);
  };

  const selectWarehouse = (warehouseId: string) => {
    if (isAdminOrTi(profile?.role)) {
      localStorage.setItem(ACTIVE_WAREHOUSE_KEY, warehouseId);
      setActiveWarehouseId(warehouseId);
    }
  };

  const activeWarehouse = warehouses.find((w) => w.id === activeWarehouseId) ?? null;

  return {
    session: profile ? { user: profile } : null,
    profile,
    warehouses,
    activeWarehouse,
    activeWarehouseId,
    selectWarehouse,
    loading: false,
    authError: null as string | null,
    signIn,
    signInDemo,
    signOut,
  };
}
