export interface NavMenuItem {
  label: string;
  href: string;
  external?: boolean;
}

export interface NavConfig {
  brand: {
    name: string;
    href: string;
  };
  menuItems: NavMenuItem[];
  cta?: {
    label: string;
    href: string;
  };
}

export const navigationConfig: NavConfig = {
  brand: {
    name: "My Hero",
    href: "/",
  },
  menuItems: [
    {
      label: "Home",
      href: "/",
    },
    {
      label: "Features",
      href: "#features",
    },
    {
      label: "App",
      href: "/realtime",
    },
    {
      label: "About",
      href: "#about",
    },
  ],
  cta: {
    label: "Get Started",
    href: "/realtime",
  },
};
