import { Router, Request, Response } from 'express';
import User from '../models/User';
import jwt from 'jsonwebtoken';
import { hashPassword, comparePassword } from '../utils/auth';
export const router = Router();

interface AuthenticatedRequest extends Request {
    user?: { id: string };
}

router.post('/register', async (req, res) => {
    try {
        const { email, password } = req.body

        if (!email) return res.status(400).send('Email is required')
        if (!password || password.length < 6) return res.status(400).send('Password is required and must be at least 6 characters')

        let userExist = await User.findOne({ where: { email } });
        if (userExist) return res.status(400).send('User already exists')
        
        const hashedPassword = await hashPassword(password)

        const user = await User.create({ email, password: hashedPassword });

        const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET as string, { expiresIn: '1h' });
        user.password = undefined as unknown as string
        res.cookie('token', token, {
            httpOnly: true
        })
        res.json(user)
    } catch (error: any) {
        res.status(500).send(`Could not register user - ${error.message}`)
    }
})

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).send('Email and password are required')
        if (password.length < 6) return res.status(400).send('Password must be at least 6 characters')

        let user = await User.findOne({raw: true, where: { email } });
        if (!user) return res.status(400).send('User does not exist');

        console.log('User found:', user.email, user.password);

        const match = await comparePassword(password, user.password)
        if (!match) return res.status(400).send('Invalid email or password')

        const token = jwt.sign({ id: user?.id }, process.env.JWT_SECRET as string, { expiresIn: '1h' });

        // return user and token to client, exclude hashed password
        if (user) {
            user.password = undefined as unknown as string;
        }
        res.cookie('token', token, {
            httpOnly: true
        })
        res.json(user)
    } catch (error: any) {
        res.status(400).send(`Could not login user - ${error.message}`)
        console.log(`Could not login user - ${error}`)
    }
})

router.get('/logout', async (req, res) => {
    try {
        res.clearCookie('token')
        return res.json({ message: 'Logout successful' })
    } catch (error: any) {
        res.status(500).send(`Could not logout user - ${error.message}`)
    }
})

router.get('/current-user', async (req: AuthenticatedRequest, res) => {
    console.log('Current user request received');
    try {
        if (!req.user) {
            console.log('No user in request');
            return res.status(401).json({ ok: false, error: 'Unauthorized' });
        }
        console.log('Fetching user with id:', req.user.id);
        const user = await User.findByPk(req.user.id, {
            attributes: { exclude: ['password'] },
        });
        if (!user) {
            console.log('User not found in database');
            return res.status(404).json({ ok: false, error: 'User not found' });
        }
        console.log('User found, sending response');
        return res.status(200).json({ ok: true, user: user });
    } catch (error: any) {
        console.error('Error in current-user route:', error);
        return res.status(500).json({ ok: false, error: `Could not fetch current user: ${error.message}` });
    }
});