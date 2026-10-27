const SECTION_TITLES: Record<string, string> = {
  api: "API",
};

export function getMenuSectionsFromCollection(
  collection: any[],
  sections?: string[]
) {
  let menu = collection.reduce((menu, entry) => {
    const key = entry.id.split("/")[0];

    let section = menu[key];

    if (!section) {
      section = {
        title: SECTION_TITLES[key] ?? key,
        items: [],
      };
      menu[key] = section;
    }

    section.items.push({
      title: entry.data.title,
      slug: entry.id,
      order: entry.data.order,
    });

    return menu;
  }, {});

  if (sections) {
    menu = Object.fromEntries(
      sections.filter((key) => key in menu).map((key) => [key, menu[key]])
    );
  }

  const flattened = Object.values(menu);

  flattened.forEach((section) => {
    section.items.sort((a, b) => a.order - b.order);
  });

  return flattened;
}

export function getMenuSectionFromCollection(
  collection: any[],
  name: string
) {
  let menu = {
    title: name,
    items: collection.map((entry) => ({
      title: entry.data.title,
      slug: entry.id,
      order: entry.data.order,
    })),
  };

  menu.items.sort((a, b) => a.order - b.order);

  return menu;
}
