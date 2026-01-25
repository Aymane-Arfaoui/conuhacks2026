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
      label: "Community",
      href: "/library",
    },
    {
      label: "Live",
      href: "/realtime",
    },
    {
      label: "Stats",
      href: "/stats",
    },
  ],
  cta: {
    label: "Get Started",
    href: "/realtime",
  },
};
