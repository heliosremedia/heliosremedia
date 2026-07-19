import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

type CreateServiceBody = {
  name?: unknown;
  slug?: unknown;
  description?: unknown;
  heroImageStorageKey?: unknown;
  heroImageAlt?: unknown;
};

type UpdateServiceBody = {
  action?: unknown;
  serviceId?: unknown;
  name?: unknown;
  slug?: unknown;
  description?: unknown;
  heroImageStorageKey?: unknown;
  heroImageAlt?: unknown;
  active?: unknown;
  serviceIds?: unknown;
};

class StaleServiceOrderError extends Error {
  constructor() {
    super("The service list changed before the new order was saved.");
    this.name = "StaleServiceOrderError";
  }
}

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getOptionalText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function serviceSelect() {
  return {
    id: true,
    name: true,
    slug: true,
    description: true,
    heroImageStorageKey: true,
    heroImageAlt: true,
    displayOrder: true,
    active: true,
    createdAt: true,
    updatedAt: true,
    _count: {
      select: {
        projects: true,
      },
    },
  } as const;
}

async function getUniqueSlug(value: string, serviceId?: string) {
  const baseSlug = slugify(value) || "service";
  let candidate = baseSlug;
  let suffix = 2;

  while (
    await prisma.service.findFirst({
      where: {
        slug: candidate,
        ...(serviceId
          ? {
              id: {
                not: serviceId,
              },
            }
          : {}),
      },
      select: {
        id: true,
      },
    })
  ) {
    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

function revalidateServicePaths() {
  revalidatePath("/admin");
  revalidatePath("/admin/services");
  revalidatePath("/admin/projects");
  revalidatePath("/portfolio");
  revalidatePath("/services");
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateServiceBody;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const requestedSlug = typeof body.slug === "string" ? body.slug.trim() : "";
    const description = getOptionalText(body.description);
    const heroImageStorageKey = getOptionalText(body.heroImageStorageKey);
    const heroImageAlt = getOptionalText(body.heroImageAlt);

    if (!name || name.length > 100) {
      return NextResponse.json(
        {
          success: false,
          error: "A service name between 1 and 100 characters is required.",
        },
        {
          status: 400,
        },
      );
    }

    if ((description?.length ?? 0) > 500) {
      return NextResponse.json(
        {
          success: false,
          error: "The service description must be 500 characters or fewer.",
        },
        {
          status: 400,
        },
      );
    }

    const slug = await getUniqueSlug(requestedSlug || name);
    const orderResult = await prisma.service.aggregate({
      _max: {
        displayOrder: true,
      },
    });

    const service = await prisma.service.create({
      data: {
        name,
        slug,
        description,
        heroImageStorageKey,
        heroImageAlt,
        displayOrder: (orderResult._max.displayOrder ?? -1) + 1,
        active: true,
      },
      select: serviceSelect(),
    });

    revalidateServicePaths();

    return NextResponse.json(
      {
        success: true,
        service,
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error("Unable to create service:", error);

    return NextResponse.json(
      {
        success: false,
        error: "The service could not be created.",
      },
      {
        status: 500,
      },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as UpdateServiceBody;
    const action = typeof body.action === "string" ? body.action.trim() : "";

    if (action === "reorder") {
      if (!Array.isArray(body.serviceIds) || body.serviceIds.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: "A complete ordered service list is required.",
          },
          {
            status: 400,
          },
        );
      }

      if (
        !body.serviceIds.every(
          (value) => typeof value === "string" && value.trim().length > 0,
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            error: "Every service ID in the new order must be valid.",
          },
          {
            status: 400,
          },
        );
      }

      const serviceIds = body.serviceIds.map((value) => value.trim());

      if (new Set(serviceIds).size !== serviceIds.length) {
        return NextResponse.json(
          {
            success: false,
            error: "The ordered service list contains duplicate IDs.",
          },
          {
            status: 400,
          },
        );
      }

      await prisma.$transaction(async (transaction) => {
        const currentServices = await transaction.service.findMany({
          select: {
            id: true,
          },
        });
        const requestedIdSet = new Set(serviceIds);

        if (
          currentServices.length !== serviceIds.length ||
          currentServices.some((service) => !requestedIdSet.has(service.id))
        ) {
          throw new StaleServiceOrderError();
        }

        for (const [index, serviceId] of serviceIds.entries()) {
          await transaction.service.update({
            where: {
              id: serviceId,
            },
            data: {
              displayOrder: -(index + 1),
            },
          });
        }

        for (const [index, serviceId] of serviceIds.entries()) {
          await transaction.service.update({
            where: {
              id: serviceId,
            },
            data: {
              displayOrder: index,
            },
          });
        }
      });

      revalidateServicePaths();

      return NextResponse.json({
        success: true,
        serviceIds,
      });
    }

    const serviceId =
      typeof body.serviceId === "string" ? body.serviceId.trim() : "";

    if (!serviceId) {
      return NextResponse.json(
        {
          success: false,
          error: "A service ID is required.",
        },
        {
          status: 400,
        },
      );
    }

    const existingService = await prisma.service.findUnique({
      where: {
        id: serviceId,
      },
      select: {
        id: true,
      },
    });

    if (!existingService) {
      return NextResponse.json(
        {
          success: false,
          error: "The selected service was not found.",
        },
        {
          status: 404,
        },
      );
    }

    if (action === "set-active") {
      if (typeof body.active !== "boolean") {
        return NextResponse.json(
          {
            success: false,
            error: "A valid service status is required.",
          },
          {
            status: 400,
          },
        );
      }

      const service = await prisma.service.update({
        where: {
          id: serviceId,
        },
        data: {
          active: body.active,
        },
        select: serviceSelect(),
      });

      revalidateServicePaths();

      return NextResponse.json({
        success: true,
        service,
      });
    }

    if (action === "update") {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      const requestedSlug =
        typeof body.slug === "string" ? body.slug.trim() : "";
      const description = getOptionalText(body.description);
      const heroImageStorageKey = getOptionalText(body.heroImageStorageKey);
      const heroImageAlt = getOptionalText(body.heroImageAlt);

      if (!name || name.length > 100) {
        return NextResponse.json(
          {
            success: false,
            error: "A service name between 1 and 100 characters is required.",
          },
          {
            status: 400,
          },
        );
      }

      if ((description?.length ?? 0) > 500) {
        return NextResponse.json(
          {
            success: false,
            error: "The service description must be 500 characters or fewer.",
          },
          {
            status: 400,
          },
        );
      }

      const slug = await getUniqueSlug(
        requestedSlug || name,
        existingService.id,
      );

      const service = await prisma.service.update({
        where: {
          id: existingService.id,
        },
        data: {
          name,
          slug,
          description,
          heroImageStorageKey,
          heroImageAlt,
        },
        select: serviceSelect(),
      });

      revalidateServicePaths();

      return NextResponse.json({
        success: true,
        service,
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: "The requested service action is not supported.",
      },
      {
        status: 400,
      },
    );
  } catch (error) {
    if (error instanceof StaleServiceOrderError) {
      return NextResponse.json(
        {
          success: false,
          error:
            "The service list changed before the new order was saved. Refresh and try again.",
        },
        {
          status: 409,
        },
      );
    }

    console.error("Unable to update service:", error);

    return NextResponse.json(
      {
        success: false,
        error: "The service could not be updated.",
      },
      {
        status: 500,
      },
    );
  }
}
