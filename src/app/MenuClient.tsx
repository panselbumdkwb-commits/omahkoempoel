"use client";

import { useMemo, useState, useTransition } from "react";
import BatikDivider from "@/components/BatikDivider";
import DateTimeBadge from "@/components/DateTimeBadge";
import { submitPublicOrderAction } from "./actions";

type Variant = { id: string; name: string; price_adjustment: number };
type Modifier = { id: string; name: string; price_adjustment: number };
type Product = {
  id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  product_variants: Variant[];
  product_modifiers: Modifier[];
};
type Category = { id: string; name: string; sort_order: number };
type TableRow = { id: string; number: string; status: string };

type CartLine = {
  key: string;
  product: Product;
  variant: Variant | null;
  modifiers: Modifier[];
  quantity: number;
  notes: string;
};

function formatRupiah(n: number) {
  return "Rp " + n.toLocaleString("id-ID");
}

export default function MenuClient({
  categories,
  products,
  tables,
  menuUnavailable,
  showDateTimeClock,
  cafeOperatingHours,
}: {
  categories: Category[];
  products: Product[];
  tables: TableRow[];
  menuUnavailable: boolean;
  showDateTimeClock: boolean;
  cafeOperatingHours: string;
}) {
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [pickerProduct, setPickerProduct] = useState<Product | null>(null);
  const [confirmation, setConfirmation] = useState<{
    orderId: string;
    orderNumber: string;
    total: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filteredProducts = useMemo(
    () =>
      activeCategory === "all"
        ? products
        : products.filter((p) => p.category_id === activeCategory),
    [products, activeCategory]
  );

  const cartTotal = useMemo(
    () =>
      cart.reduce((sum, line) => {
        const modTotal = line.modifiers.reduce((s, m) => s + Number(m.price_adjustment), 0);
        const variantAdj = line.variant ? Number(line.variant.price_adjustment) : 0;
        return sum + line.quantity * (Number(line.product.price) + variantAdj + modTotal);
      }, 0),
    [cart]
  );
  const cartCount = cart.reduce((sum, l) => sum + l.quantity, 0);

  function openProduct(product: Product) {
    if (product.product_variants.length > 0 || product.product_modifiers.length > 0) {
      setPickerProduct(product);
    } else {
      addToCart(product, null, []);
    }
  }

  function addToCart(product: Product, variant: Variant | null, modifiers: Modifier[]) {
    const key = `${product.id}-${variant?.id ?? "none"}-${modifiers
      .map((m) => m.id)
      .sort()
      .join(",")}`;
    setCart((prev) => {
      const existing = prev.find((l) => l.key === key);
      if (existing) {
        return prev.map((l) => (l.key === key ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [...prev, { key, product, variant, modifiers, quantity: 1, notes: "" }];
    });
    setPickerProduct(null);
    setCartOpen(true);
  }

  function changeQty(key: string, delta: number) {
    setCart((prev) =>
      prev
        .map((l) => (l.key === key ? { ...l, quantity: l.quantity + delta } : l))
        .filter((l) => l.quantity > 0)
    );
  }

  function submitOrder() {
    if (cart.length === 0) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await submitPublicOrderAction({
          items: cart.map((l) => ({
            productId: l.product.id,
            variantId: l.variant?.id ?? null,
            quantity: l.quantity,
            notes: l.notes || undefined,
            modifierIds: l.modifiers.map((m) => m.id),
          })),
        });
        setConfirmation({
          orderId: result.orderId,
          orderNumber: result.orderNumber,
          total: result.grandTotal,
        });
        setCart([]);
        setCartOpen(false);
      } catch (err: any) {
        setError(err.message ?? "Gagal membuat pesanan. Silakan coba lagi.");
      }
    });
  }

  if (menuUnavailable) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-wood-grain p-8">
        <div className="max-w-md text-center bg-parchment rounded-lg p-8">
          <h1 className="font-ukir text-2xl text-wood-dark mb-2">Omah Koempoel</h1>
          <p className="text-wood-mid">
            Menu sedang tidak dapat dimuat saat ini. Silakan hubungi staf kami untuk memesan.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-wood-grain pb-28">
      {/* HERO */}
      <header className="px-6 pt-10 pb-4 text-center">
        <p className="font-jakarta text-batik-gold tracking-[0.3em] text-xs uppercase mb-2">
          Ngumpul · Ngopi · Nikmati
        </p>
        <h1 className="font-ukir text-4xl sm:text-5xl text-parchment mb-1">Omah Koempoel</h1>
        <p className="font-jakarta text-wood-light text-sm">Pilih menu, sentuh untuk memesan</p>
        {showDateTimeClock && (
          <DateTimeBadge variant="full" className="block font-jakarta text-batik-gold text-xs mt-3" />
        )}
        <p className="font-jakarta text-wood-light text-xs mt-1">🕐 Jam Buka: {cafeOperatingHours}</p>
      </header>
      <BatikDivider className="opacity-70" />

      {/* CATEGORY TABS */}
      <nav className="sticky top-0 z-20 bg-wood-dark/90 backdrop-blur px-4 py-3 flex gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveCategory("all")}
          className={`shrink-0 px-5 py-2.5 rounded-full font-jakarta text-sm font-semibold border transition ${
            activeCategory === "all"
              ? "bg-batik-gold text-wood-dark border-batik-gold"
              : "text-parchment border-wood-light"
          }`}
        >
          Semua
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveCategory(c.id)}
            className={`shrink-0 px-5 py-2.5 rounded-full font-jakarta text-sm font-semibold border transition ${
              activeCategory === c.id
                ? "bg-batik-gold text-wood-dark border-batik-gold"
                : "text-parchment border-wood-light"
            }`}
          >
            {c.name}
          </button>
        ))}
      </nav>

      {/* PRODUCT GRID */}
      <section className="px-4 py-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {filteredProducts.map((product) => (
          <button
            key={product.id}
            onClick={() => openProduct(product)}
            className="relative text-left bg-parchment rounded-xl p-4 shadow-lg active:scale-95 transition-transform border border-batik-gold/30"
          >
            <div className="w-full aspect-square rounded-lg bg-wood-light/30 mb-3 flex items-center justify-center text-3xl overflow-hidden relative">
              {product.image_url ? (
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                "🍽️"
              )}
              <span className="absolute bottom-1.5 right-1.5 w-7 h-7 rounded-full bg-sogan text-parchment font-jakarta font-bold text-lg flex items-center justify-center shadow-md">
                +
              </span>
            </div>
            <h3 className="font-jakarta font-semibold text-wood-dark leading-snug">{product.name}</h3>
            {product.description && (
              <p className="font-jakarta text-xs text-wood-mid mt-1 line-clamp-2">
                {product.description}
              </p>
            )}
            <p className="font-jakarta font-bold text-sogan mt-2">{formatRupiah(product.price)}</p>
          </button>
        ))}
        {filteredProducts.length === 0 && (
          <p className="col-span-full text-center text-parchment/70 py-10 font-jakarta">
            Belum ada menu di kategori ini.
          </p>
        )}
      </section>

      {/* FLOATING CART BUTTON — selalu tampil, termasuk saat keranjang masih kosong,
          supaya pembeli tahu sejak awal bahwa alur pemesanan ada di sini. */}
      {!cartOpen && (
        <button
          onClick={() => cartCount > 0 && setCartOpen(true)}
          disabled={cartCount === 0}
          className="fixed bottom-6 right-6 z-30 bg-sogan text-parchment font-jakarta font-bold px-6 py-4 rounded-full shadow-xl flex items-center gap-2 disabled:opacity-60"
        >
          {cartCount > 0
            ? `🧺 PESAN (${cartCount}) · ${formatRupiah(cartTotal)}`
            : "🧺 Keranjang kosong — sentuh menu untuk memesan"}
        </button>
      )}

      {/* PRODUCT OPTION PICKER MODAL */}
      {pickerProduct && (
        <ProductPicker
          product={pickerProduct}
          onClose={() => setPickerProduct(null)}
          onConfirm={(variant, modifiers) => addToCart(pickerProduct, variant, modifiers)}
        />
      )}

      {/* CART TRAY */}
      {cartOpen && (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center sm:justify-center bg-black/50">
          <div className="w-full sm:max-w-lg bg-parchment rounded-t-2xl sm:rounded-2xl max-h-[85vh] flex flex-col overflow-hidden">
            <BatikDivider />
            <div className="p-5 flex justify-between items-center">
              <h2 className="font-ukir text-xl text-wood-dark">Keranjang Anda</h2>
              <button onClick={() => setCartOpen(false)} className="text-wood-mid font-jakarta text-sm">
                Tutup
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 divide-y divide-wood-light/30">
              {cart.map((line) => (
                <div key={line.key} className="py-3 flex justify-between items-start gap-3">
                  <div>
                    <p className="font-jakarta font-semibold text-wood-dark">{line.product.name}</p>
                    {line.variant && <p className="text-xs text-wood-mid">{line.variant.name}</p>}
                    {line.modifiers.length > 0 && (
                      <p className="text-xs text-wood-mid">
                        {line.modifiers.map((m) => m.name).join(", ")}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => changeQty(line.key, -1)}
                      className="w-8 h-8 rounded-full border border-wood-mid text-wood-dark"
                    >
                      −
                    </button>
                    <span className="font-jakarta w-5 text-center">{line.quantity}</span>
                    <button
                      onClick={() => changeQty(line.key, 1)}
                      className="w-8 h-8 rounded-full border border-wood-mid text-wood-dark"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
              {cart.length === 0 && (
                <p className="text-center text-wood-mid py-8 font-jakarta">Keranjang kosong.</p>
              )}
            </div>

            <div className="p-5 border-t border-wood-light/30 space-y-3">
              <p className="text-xs text-wood-mid font-jakarta">
                Nomor meja & nama Anda akan dilengkapi oleh kasir saat memproses pesanan.
              </p>

              <div className="flex justify-between font-jakarta font-bold text-wood-dark text-lg">
                <span>Total</span>
                <span>{formatRupiah(cartTotal)}</span>
              </div>

              {error && <p className="text-sogan text-sm font-jakarta">{error}</p>}

              <button
                onClick={submitOrder}
                disabled={isPending || cart.length === 0}
                className="w-full bg-sogan text-parchment font-jakarta font-bold py-4 rounded-md disabled:opacity-50"
              >
                {isPending ? "Mengirim pesanan..." : "SELESAI"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL */}
      {confirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
          <div className="bg-parchment rounded-2xl max-w-sm w-full p-8 text-center">
            <div className="text-4xl mb-3">✅</div>
            <h2 className="font-ukir text-2xl text-wood-dark mb-2">Pesanan Diterima</h2>
            <p className="font-jakarta text-wood-mid mb-1">Nomor pesanan Anda:</p>
            <p className="font-jakarta font-bold text-sogan text-lg mb-4">{confirmation.orderNumber}</p>
            <p className="font-jakarta text-wood-mid mb-6">
              Total: {formatRupiah(confirmation.total)}
              <br />
              Silakan tunjukkan nomor ini ke kasir untuk pembayaran.
            </p>
            <a
              href={`/status/${confirmation.orderId}`}
              className="block w-full bg-batik-gold text-wood-dark font-jakarta font-bold py-3 rounded-md mb-3"
            >
              Pantau Status Pesanan
            </a>
            <button
              onClick={() => setConfirmation(null)}
              className="w-full bg-daun text-parchment font-jakarta font-bold py-3 rounded-md"
            >
              Pesan Lagi
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

function ProductPicker({
  product,
  onClose,
  onConfirm,
}: {
  product: Product;
  onClose: () => void;
  onConfirm: (variant: Variant | null, modifiers: Modifier[]) => void;
}) {
  const [variant, setVariant] = useState<Variant | null>(product.product_variants[0] ?? null);
  const [modifiers, setModifiers] = useState<Modifier[]>([]);

  function toggleModifier(m: Modifier) {
    setModifiers((prev) =>
      prev.some((x) => x.id === m.id) ? prev.filter((x) => x.id !== m.id) : [...prev, m]
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center sm:justify-center bg-black/50">
      <div className="w-full sm:max-w-md bg-parchment rounded-t-2xl sm:rounded-2xl max-h-[85vh] overflow-y-auto p-6">
        <h2 className="font-ukir text-2xl text-wood-dark mb-1">{product.name}</h2>
        <p className="font-jakarta font-bold text-sogan mb-4">{formatRupiah(product.price)}</p>

        {product.product_variants.length > 0 && (
          <div className="mb-4">
            <p className="font-jakarta font-semibold text-wood-dark mb-2">Pilihan</p>
            <div className="flex flex-wrap gap-2">
              {product.product_variants.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setVariant(v)}
                  className={`px-4 py-2 rounded-full border font-jakarta text-sm ${
                    variant?.id === v.id
                      ? "bg-daun text-parchment border-daun"
                      : "text-wood-dark border-wood-light"
                  }`}
                >
                  {v.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {product.product_modifiers.length > 0 && (
          <div className="mb-6">
            <p className="font-jakarta font-semibold text-wood-dark mb-2">Tambahan</p>
            <div className="flex flex-wrap gap-2">
              {product.product_modifiers.map((m) => (
                <button
                  key={m.id}
                  onClick={() => toggleModifier(m)}
                  className={`px-4 py-2 rounded-full border font-jakarta text-sm ${
                    modifiers.some((x) => x.id === m.id)
                      ? "bg-batik-gold text-wood-dark border-batik-gold"
                      : "text-wood-dark border-wood-light"
                  }`}
                >
                  {m.name}
                  {Number(m.price_adjustment) > 0 && ` (+${formatRupiah(Number(m.price_adjustment))})`}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-md border border-wood-light font-jakarta text-wood-dark"
          >
            Batal
          </button>
          <button
            onClick={() => onConfirm(variant, modifiers)}
            className="flex-1 py-3 rounded-md bg-sogan text-parchment font-jakarta font-bold"
          >
            Tambah ke Keranjang
          </button>
        </div>
      </div>
    </div>
  );
}
