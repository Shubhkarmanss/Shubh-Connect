import { User } from "../models/user.model.js"; //we put model.js and if we don't put .js then error will come
import bcrypt from "bcryptjs"; // for hashed password
import jwt from "jsonwebtoken";
import getDataUri from "../utils/datauri.js";
import cloudinary from "../utils/cloudinary.js";
import { Post } from "../models/post.model.js";
export const register = async (req, res) => { // code for register the user
    try {
        const { username, email, password } = req.body; // these are required to submit the form and we want these three together so we use req.body
        // and if we want them single single then we use req.body.username 
        if (!username || !email || !password) {
            return res.status(401).json({ //data me response bhejna h
                message: "Something is missing, please check!",
                success: false,
            });
        }
        const user = await User.findOne({ email }); //here we will check ki osi email id se koi aur user toh nahi h so before registering we will do await. so from user schema model we take user 
        if (user) { //agar use ha toh os se account nahi banana
            return res.status(401).json({
                message: "Try different email",
                success: false,
            });
        };
        const hashedPassword = await bcrypt.hash(password, 10); // here the password, should be safe so we did hashed password and 10 defines ki password ko kitna hashed krna h kitna khatarnak hashed krna h, and this 10 is called as salt value

        await User.create({ //agar user already nahi h so we do register
            username, // yaha pr vo chez dalo jo jo required hota h
            email,  // yaha pr vo chez dalo jo jo required hota h
            password: hashedPassword // yaha pr vo chez dalo jo jo required hota h
        });
        return res.status(201).json({ 
            //jab bhi kuch create hota h toh oska status code 201 hota h
            message: "Account created successfully.",
            success: true,
        });
    } catch (error) {
        console.log(error);
    }
}
export const login = async (req, res) => { // code to login a user
    try {
        const { email, password } = req.body; // login krte time kya kya chahiye
        if (!email || !password) { // agar missing toh return 
            return res.status(401).json({
                message: "Something is missing, please check!",
                success: false,
            });
        }
        let user = await User.findOne({ email });
        if (!user) { //agar user name exit nahi krta toh toh jo mrji password daldo toh login hi nahi hoga 
            return res.status(401).json({
                message: "Incorrect email or password",
                success: false,
            });
        }


        //agar password hi galat dal diya, jo user ne dala aur jo data base me add h vo same hona chahiye
        const isPasswordMatch = await bcrypt.compare(password, user.password);
        if (!isPasswordMatch) {
            return res.status(401).json({
                message: "Incorrect email or password",
                success: false,
            });
        };
// in browser go to inspect them application then cookies
        //ab jab sab ho chuka so create a token and is stored in cookies 
        // so what is token is ki agar toh cookie me token hota h toh means k iuser site pr h login h aur agar token nahi hota cookies me toh iska matlab user ne logout kr diya ab vo site pr nahi h
        const token = await jwt.sign({ userId: user._id }, process.env.SECRET_KEY, { expiresIn: '1d' }); // 1d means 24 hours, so after 1 day it gets expire

        // populate each post if in the posts array
        const populatedPosts = await Promise.all(
            user.posts.map( async (postId) => {
                const post = await Post.findById(postId);
                if(post.author.equals(user._id)){
                    return post;
                }
                return null;
            })
        )
        user = { //make a object, don't show password
            _id: user._id,
            username: user.username,
            email: user.email,
            profilePicture: user.profilePicture,
            bio: user.bio,
            followers: user.followers,
            following: user.following,
            posts: populatedPosts
        }
        return res.cookie('token', token, { httpOnly: true, sameSite: 'strict', maxAge: 1 * 24 * 60 * 60 * 1000 }).json({
            message: `Welcome back ${user.username}`,
            success: true,
            user
        });

    } catch (error) {
        console.log(error);
    }
};
export const logout = async (_, res) => {
    try {
        return res.cookie("token", "", { maxAge: 0 }).json({ // cookie ke ander ka token delete krdo, empty string krdo iska matlab false hota h
            message: 'Logged out successfully.',
            success: true
        });
    } catch (error) {
        console.log(error);
    }
};
export const editProfile = async (req, res) => { //sirf apni profile ko hi edit kr sakte ho ye nahi ki kisi ki bhi krlo, so now how to know ki kis id ko kr sakte h, so now we see the user id present in token
    try {
        const userId = req.id;
        const { bio, gender } = req.body;
        const profilePicture = req.file; //to get file picture
        let cloudResponse;

        if (profilePicture) {//agar profile picture hogi tabhi ye krna
            const fileUri = getDataUri(profilePicture);
            cloudResponse = await cloudinary.uploader.upload(fileUri);
        }

        const user = await User.findById(userId).select('-password');//user ha bhi ke nahi
        if (!user) {
            return res.status(404).json({
                message: 'User not found.',
                success: false
            });
        };
        if (bio) user.bio = bio;
        if (gender) user.gender = gender;
        if (profilePicture) user.profilePicture = cloudResponse.secure_url;

        await user.save();

        return res.status(200).json({
            message: 'Profile updated.',
            success: true,
            user
        });

    } catch (error) {
        console.log(error);
    }
};
export const getSuggestedUsers = async (req, res) => { //to have some suggested users, like followers ke followers suggestions me ya koi bhi algorithm hoti h but here we don't use any algorithm
    try {
        const suggestedUsers = await User.find({ _id: { $ne: req.id } }).select("-password");//vo sare users dedo jiski id not equal to any , aur bs password nahi cahhiye baki sab dedo
        if (!suggestedUsers) {// aur agar suggested user nahi h toh ye msg show krdo
            return res.status(400).json({
                message: 'Currently do not have any users',
            })
        };
        return res.status(200).json({
            success: true,
            users: suggestedUsers //sugested users bhejdo
        })
    } catch (error) {
        console.log(error);
    }
};
export const followOrUnfollow = async (req, res) => {
    try {
        const followKrneWala = req.id; // shubh (meri id)
        const jiskoFollowKrunga = req.params.id; // shivani (jisko follow karunga)
        if (followKrneWala === jiskoFollowKrunga) {//agar khud ki hi ho
            return res.status(400).json({
                message: 'You cannot follow/unfollow yourself',
                success: false
            });
        }

        const user = await User.findById(followKrneWala);
        const targetUser = await User.findById(jiskoFollowKrunga);

        if (!user || !targetUser) {
            return res.status(400).json({
                message: 'User not found',
                success: false
            });
        }
        //now mai check krunga ki follow krna hai ya unfollow
        const isFollowing = user.following.includes(jiskoFollowKrunga); 
        if (isFollowing) {//matlab mene already follow kiya hua htoh yaha unfollow logic ayega
            // unfollow logic ayega
            await Promise.all([ // jab bhi ek time pr do do documents ko handle krte h toh hum promis.all  ko use krte h.
                User.updateOne({ _id: followKrneWala }, { $pull: { following: jiskoFollowKrunga } }),
                User.updateOne({ _id: jiskoFollowKrunga }, { $pull: { followers: followKrneWala } }),
            ])
            return res.status(200).json({ message: 'Unfollowed successfully', success: true });
        } else {
            // follow logic ayega
            await Promise.all([ // jab bhi ek time pr do do documents ko handle krte h toh hum promis.all  ko use krte h. user and target.
                User.updateOne({ _id: followKrneWala }, { $push: { following: jiskoFollowKrunga } }),
                User.updateOne({ _id: jiskoFollowKrunga }, { $push: { followers: followKrneWala } }),
            ])
            return res.status(200).json({ message: 'followed successfully', success: true });
        }
    } catch (error) {
        console.log(error);
    }
}