# 🛒 Sistema POS Multi-Sucursal (`sistema-pos-react`)

Aplicación web de **Punto de Venta (POS)** diseñada para la gestión ágil de ventas en mostrador, control de existencias por sucursal, administración de listas de precios y cortes de caja.

Desplegada en **Cloudflare Pages** como una **Single Page Application (SPA) 100% autónoma**, persiste todas las operaciones localmente mediante `localStorage` para probar flujos comerciales completos sin requerir base de datos externa.

---

## 🌐 Demo en Vivo

- **Producción (Cloudflare Pages):** *(Agrega aquí tu enlace `*.pages.dev` o subdominio activo)*

---

## ✨ Características Principales

- **Caja y Carrito Persistente:** Búsqueda instantánea por nombre, SKU, medida o espesor; filtro de disponibilidad y conservación automática del carrito en curso ante cambios de pestaña o recargas del navegador.
- **Múltiples Métodos de Pago:** Cobros en **Efectivo** (con cálculo automático de cambio), **Transferencia**, **Tarjeta** y **Pago Mixto**, además de descuentos y notas por venta.
- **Operación Multi-Sucursal:** Cambio dinámico entre sucursales (*Lagos*, *Hilario*, *San Pancho*) con inventario y movimientos independientes.
- **Control de Existencias en Tiempo Real:** Descuento automático de stock al completar cada venta y validación de disponibilidad en catálogo.
- **Historial y Corte de Caja:** Registro detallado de transacciones, desglose por método de pago y generación de corte de caja.
- **Gestión de Precios:** Módulo dedicado para actualizar precios de venta al momento con reflejo inmediato en caja.
- **Modo Demo Restaurable:** Catálogo precargado y opción para reiniciar `localStorage` al estado inicial en un clic.

---

## 🛠️ Stack Tecnológico

- **Frontend:** React + TypeScript
- **Build Tool:** Vite
- **Estilos:** Tailwind CSS (Interfaz Dark Mode)
- **Persistencia:** Web Storage API (`localStorage`)
- **Hosting & CI/CD:** Cloudflare Pages

---

## 🚀 Ejecución Local

```bash
git clone [https://github.com/maxvaldezmun/sistema-pos-react.git](https://github.com/maxvaldezmun/sistema-pos-react.git)
cd sistema-pos-react
npm install
npm run dev
