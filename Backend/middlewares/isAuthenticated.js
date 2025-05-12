import jwt from "jsonwebtoken";
const isAuthenticated = async (req,res,next)=>{ //this checks that the user is loked in or  not? means token ha ke nahi
    try {
        const token = req.cookies.token; // token is present in cookie
        if(!token){
            return res.status(401).json({ //agar token nahi h 
                message:'User not authenticated',
                success:false
            });
        }
        //sirf token mil jane pr hum nahi keh sakte ki authenticated h, osko verify bhi karenge
        const decode = await jwt.verify(token, process.env.SECRET_KEY);// agar token mil gya toh osko verify bhi karenge

        if(!decode){
            return res.status(401).json({ //agar veerify nahi ho raha
                message:'Invalid',
                success:false
            });
        }
        req.id = decode.userId;
        next();
    } catch (error) {
        console.log(error);
    }
}
export default isAuthenticated;