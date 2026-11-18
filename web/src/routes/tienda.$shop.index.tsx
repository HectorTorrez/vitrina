import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search, X } from "lucide-react";
import { acceptsBookings, shopQuery, productImage, type Product } from "../catalog";
import { pageHead, siteLanguage } from "../seo";
import { foldAccents } from "../slug";
import { StoreLayout } from "../store/StoreLayout";
import { ProductCard, ShopHero } from "../store/StoreParts";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/tienda/$shop/")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(shopQuery(params.shop)),
  head: ({ loaderData, params }) => {
    if (!loaderData) return {};
    const { name, origin, products } = loaderData;
    const first = products.map(productImage).find(Boolean);
    const url = origin + "/tienda/" + params.shop;
    const description = loaderData.description.trim() || "Explorá el catálogo y los precios de " + name + " en Vitrina.";
    return pageHead({
      title: name + " · Catálogo en Vitrina",
      description,
      url,
      image: first && new URL(first, origin).href,
      indexable: products.length > 0,
      structuredData: {
        "@type": "CollectionPage",
        name,
        url,
        description,
        inLanguage: siteLanguage,
        mainEntity: products.length ? {
          "@type": "ItemList",
          itemListElement: products.map((product, index) => ({
            "@type": "ListItem", position: index + 1, name: product.name, url: url + "/" + product.slug,
          })),
        } : undefined,
      },
    });
  },
  component: Catalog,
});

type Filter = "all" | Product["kind"];

const normalize = (text: string) => foldAccents(text).toLowerCase();

function Catalog() {
  const { shop } = Route.useParams();
  const { data } = useQuery({ ...shopQuery(shop), initialData: Route.useLoaderData() });
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const bookable = acceptsBookings(data) && data.products.some((p) => p.kind === "service");

  const counts = {
    all: data.products.length,
    product: data.products.filter((p) => p.kind === "product").length,
    service: data.products.filter((p) => p.kind === "service").length,
  };
  const visible = useMemo(() => {
    const words = normalize(query.trim());
    return data.products.filter((p) => (filter === "all" || p.kind === filter) && (!words || normalize(p.name).includes(words)));
  }, [data.products, filter, query]);

  const filters: { value: Filter; label: string }[] = [
    { value: "all", label: "Todo" },
    { value: "service", label: "Servicios" },
    { value: "product", label: "Productos" },
  ];
  const showFilters = counts.product > 0 && counts.service > 0;

  return (
    <StoreLayout shop={data} slug={shop}>
      <ShopHero shop={data} bookable={bookable} />

      <div className={cn("sticky top-16 z-20 -mx-4 flex flex-wrap items-center gap-3 border-y border-store-rule bg-store-bg/90 px-4 py-3 backdrop-blur-md @3xl:mx-0 @3xl:rounded-full @3xl:border @3xl:px-3 @3xl:py-2", counts.all <= 4 && "@3xl:w-fit")}>
        <h2 className="sr-only">Catálogo</h2>
        {showFilters ? (
          <div className="flex gap-1" role="tablist" aria-label="Filtrar">
            {filters.map((option) => (
              <button
                key={option.value} type="button" role="tab" aria-selected={filter === option.value}
                onClick={() => setFilter(option.value)}
                className={cn(
                  "h-9 rounded-full px-4 text-sm font-medium transition",
                  filter === option.value ? "bg-store-accent text-store-accent-ink" : "hover:bg-store-soft",
                )}
              >
                {option.label} <span className="ml-0.5 opacity-60">{counts[option.value]}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="px-2 text-sm font-medium">
            {counts.all} {counts.all === 1 ? "opción" : "opciones"}
          </p>
        )}
        {counts.all > 4 && (
          <label className="relative ml-auto flex w-full items-center @xl:w-64">
            <Search className="pointer-events-none absolute left-3 size-4 text-store-muted" />
            <input
              type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar en el catálogo"
              className="h-9 w-full rounded-full border border-store-rule bg-store-surface pr-9 pl-9 text-sm text-store-ink outline-none placeholder:text-store-muted focus:border-store-ink [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <button type="button" aria-label="Limpiar búsqueda" onClick={() => setQuery("")} className="absolute right-2 grid size-6 place-items-center rounded-full hover:bg-store-soft">
                <X className="size-3.5" />
              </button>
            )}
          </label>
        )}
      </div>

      {visible.length > 0 ? (
        <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 @3xl:grid-cols-3 @3xl:gap-x-6 @3xl:gap-y-10 @5xl:grid-cols-4">
          {visible.map((p) => (
            <Link key={p.slug} to="/tienda/$shop/$product" params={{ shop, product: p.slug }} className="rounded-2xl outline-offset-4 focus-visible:outline-2 focus-visible:outline-store-ink">
              <ProductCard product={p} />
            </Link>
          ))}
        </div>
      ) : (
        <div className="mt-8 grid justify-items-center gap-2 rounded-2xl border border-dashed border-store-rule px-6 py-16 text-center">
          <p className="font-store text-2xl">{counts.all ? "Sin resultados" : "Muy pronto"}</p>
          <p className="text-store-muted">
            {counts.all ? "Probá con otra búsqueda o filtro." : "Esta tienda todavía está preparando su catálogo."}
          </p>
        </div>
      )}
    </StoreLayout>
  );
}
