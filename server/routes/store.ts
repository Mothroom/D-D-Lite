import express, { Request, Response } from 'express';
import axios from 'axios';
import prisma from './prisma';

const storeRouter = express.Router();

storeRouter.get('/equipment', async (req: Request, res: Response) => {
  try {
    const response = await axios.get('https://www.dnd5eapi.co/api/equipment');
    res.json(response.data.results);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching equipment data' });
  }
});

storeRouter.get('/store/magic-items', async (req: Request, res: Response) => {
  console.log('MI Request:', req);
  try {
    const response = await axios.get('https://www.dnd5eapi.co/api/magic-items/');
    console.log('Magical Equipment:', response.data.results);
    res.json(response.data.results);
  } catch (error) {
    console.error('Error fetching magic items:', error);
    res.status(500).send('Error fetching magic items');
  }
});

storeRouter.get('/equipment/:index', async (req: Request, res: Response) => {
  const { index } = req.params;
  try {
    const response = await axios.get(`https://www.dnd5eapi.co/api/equipment/${index}`);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch specific equipment' });
  }
});

storeRouter.get('/gold', async (req: Request, res: Response) => {
  const userId = parseInt(req.query.userId as string, 10);

  if (!userId) {
    return res.status(400).json({ message: 'User ID is required' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { gold: true },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ gold: user.gold });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

storeRouter.post('/buy', async (req: Request, res: Response) => {
  console.log('Buy Request:', req.body);
  const { userId, equipmentName } = req.body;
  if (!userId || !equipmentName) {
    return res.status(400).json({ message: 'User ID, Equipment ID, and Equipment Name are required' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { gold: true },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.gold < 50) {
      return res.status(400).json({ message: 'Not enough gold to buy this item' });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { gold: user.gold - 50 },
    });

    const inventory = await prisma.inventory.findFirst({
      where: { userId: userId },
    });

    if (!inventory) {
      return res.status(404).json({ message: 'Inventory not found' });
    }

    const existingItem = await prisma.equipment.findFirst({
      where: {
        name: equipmentName,
        inventoryId: inventory.id,
      },
    });

    if (existingItem) {
      await prisma.equipment.update({
        where: { id: existingItem.id },
        data: { owned: existingItem.owned + 1 },
      });
    } else {
      await prisma.equipment.create({
        data: {
          name: equipmentName,
          inventoryId: inventory.id,
          owned: 1,
        },
      });
    }

    res.json({ message: 'Equipment bought successfully' });
  } catch (error) {
    console.error('Error buying equipment:', error);
    res.status(500).json({ message: 'Error processing the purchase' });
  }
});

storeRouter.post('/sell', async (req: Request, res: Response) => {
  const { userId, equipmentName } = req.body;
  if (!userId) {
    return res.status(400).json({ message: 'User ID and Equipment ID are required' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { gold: true },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const inventory = await prisma.inventory.findFirst({
      where: { userId: userId },
    });

    if (!inventory) {
      return res.status(404).json({ message: 'Inventory not found' });
    }

    const existingItem = await prisma.equipment.findFirst({
      where: {
        name: equipmentName,
        inventoryId: inventory.id,
      },
    });

    if (!existingItem || existingItem.owned <= 0) {
      return res.status(400).json({ message: 'You do not own this item' });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { gold: user.gold + 50 },
    });

    await prisma.equipment.update({
      where: { id: existingItem.id },
      data: { owned: existingItem.owned - 1 },
    });

    res.json({ message: 'Equipment sold successfully' });
  } catch (error) {
    console.error('Error selling equipment:', error);
    res.status(500).json({ message: 'Error processing the sale' });
  }
});

export default storeRouter;
