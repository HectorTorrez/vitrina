import { createFileRoute, redirect } from "@tanstack/react-router";
import { getHome, landingHead, LandingPage } from "../LandingPage";

export const Route = createFileRoute("/en")({
  loader: async () => {
    const data = await getHome();
    if (data.home) throw redirect({ to: "/tienda/$shop", params: { shop: data.home } });
    return data;
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { links: [{ rel: "preload", as: "image", href: "/landing/escenario.jpg" }] };
    return landingHead(loaderData.origin, "en");
  },
  component: () => <LandingPage shops={Route.useLoaderData().shops} routeLocale="en" />,
});
