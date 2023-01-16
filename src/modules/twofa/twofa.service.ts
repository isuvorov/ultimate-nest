import { BaseRepository } from "@common/database";
import { User } from "@entities";
import { InjectRepository } from "@mikro-orm/nestjs";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Response } from "express";
import { authenticator } from "otplib";
import { toFileStream } from "qrcode";
import { from, map, Observable } from "rxjs";

@Injectable()
export class TwoFactorAuthenticationService {
	constructor(
		@InjectRepository(User)
		private userRepository: BaseRepository<User>,
		private readonly configService: ConfigService,
	) {}

	/**
	 * It generates a secret, creates an OTP Auth URL, assigns the secret to the user, and flushes the user
	 * repository
	 * @param {User} user - User - The user object that we want to generate the secret for.
	 * @returns An Observable that returns an object with a secret and otpAuthUrl.
	 */

	generateTwoFactorAuthenticationSecret(
		user: User,
	): Observable<{ secret: string; otpAuthUrl: string }> {
		const secret = authenticator.generateSecret();

		const otpAuthUrl = authenticator.keyuri(
			user.email,
			this.configService.get("app.name"),
			secret,
		);

		this.userRepository.assign(user, { twoFactorAuthenticationSecret: secret });

		return from(this.userRepository.flush()).pipe(
			map(() => {
				return { secret, otpAuthUrl };
			}),
		);
	}

	/**
	 * It takes a response stream and an otpAuthUrl, and returns a file stream
	 * @param {Response} stream - Response - The response from the HTTP request
	 * @param {string} otpAuthUrl - The OTP Auth URL that you want to generate a QR code for.
	 * @returns A promise that resolves to a file stream.
	 */
	pipeQrCodeStream(stream: Response, otpAuthUrl: string) {
		return from(toFileStream(stream, otpAuthUrl));
	}

	/**
	 * It returns true if the two factor authentication code is valid for the user, and false otherwise
	 * @param {string} twoFactorAuthenticationCode - The code that the user entered in the form.
	 * @param {User} user - The user object that we're checking the two factor authentication code for.
	 * @returns A boolean value.
	 */
	isTwoFactorAuthenticationCodeValid(twoFactorAuthenticationCode: string, user: User): boolean {
		return authenticator.verify({
			token: twoFactorAuthenticationCode,
			secret: user.twoFactorAuthenticationSecret,
		});
	}

	/**
	 * It takes a two factor authentication code and a user, checks if the code is valid, and if it is, it
	 * enables two factor authentication for the user
	 * @param {string} twoFactorAuthenticationCode - The code that the user has entered in the form.
	 * @param {User} user - User - the user that is trying to turn on two factor authentication
	 * @returns Observable<User>
	 */
	turnOnTwoFactorAuthentication(
		twoFactorAuthenticationCode: string,
		user: User,
	): Observable<User> {
		const isCodeValid = this.isTwoFactorAuthenticationCodeValid(
			twoFactorAuthenticationCode,
			user,
		);

		if (!isCodeValid) {
			throw new UnauthorizedException("Wrong authentication code");
		}

		this.userRepository.assign(user, { isTwoFactorAuthenticationEnabled: true });

		return from(this.userRepository.flush()).pipe(map(() => user));
	}
}
