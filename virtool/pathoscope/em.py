def run(U, NU, genomes, verbose=False, max_iter=50, epsilon=1e-7, pi_prior=0, theta_prior=0):
    # Initial values
    theta = [1 / genomes.count] * genomes.count
    pi = list(theta)
    initPi = list(pi)

    pisum0 = [0] * genomes.count

    # weights for unique reads...
    Uweights = [U[i][1] for i in U]
    maxUweights = 0
    Utotal = 0

    if Uweights:
        maxUweights = max(Uweights)
        Utotal = sum(Uweights)

    # pisum0/Utotal would be the weighted proportions of unique reads assigned to each genome (weights are
    # alignment scores)
    for i in U:
        pisum0[U[i][0]] += U[i][1]

    # weights for non-unique reads...
    NUweights = [NU[i][3] for i in NU]
    maxNUweights = 0
    NUtotal = 0

    if NUweights:
        maxNUweights = max(NUweights)
        NUtotal = sum(NUweights)

    priorWeight = max(maxUweights, maxNUweights)
    lenNU = len(NU)

    if lenNU == 0:
        lenNU = 1

    # EM iterations
    for i in range(max_iter):
        pi_old = pi
        thetasum = [0] * genomes.count

        # E Step (for each non-uniq read, j)
        for j in NU:
            z = NU[j]

            # A set of any genome mapping with j
            ind = z[0]

            # Get relevant pis for the read
            pitmp = [pi[k] for k in ind]

            # Get relevant thetas for the read
            thetatmp = [theta[k] for k in ind]

            # Calculate unormalized xs
            xtmp = [pitmp[k] * thetatmp[k] * z[1][k] for k in range(len(ind))]

            xsum = sum(xtmp)

            if xsum == 0:
                # Avoiding dividing by 0 at all times
                xnorm = [0] * len(xtmp)

            else:
                # Normalize new xs
                xnorm = [k / xsum for k in xtmp]

            # Update x in NU
            NU[j][2] = xnorm

            for k in range(len(ind)):
                # Keep weighted running tally for theta
                thetasum[ind[k]] += xnorm[k] * NU[j][3]

        # M step
        # Calculate tally for pi
        pisum = [thetasum[k] + pisum0[k] for k in range(len(thetasum))]

        pip = pi_prior * priorWeight
        totaldiv = Utotal + NUtotal

        if totaldiv == 0:
            totaldiv = 1

        # Update pi
        pi = [(k + pip) / (Utotal + NUtotal + pip * len(pisum)) for k in pisum]

        if i == 0:
            initPi = pi

        thetap = theta_prior * priorWeight

        NUtotaldiv = NUtotal
        if NUtotaldiv == 0:
            NUtotaldiv = 1

        theta = [(k + thetap) / (NUtotaldiv + thetap * len(thetasum)) for k in thetasum]

        cutoff = 0.0

        for k in range(len(pi)):
            cutoff += abs(pi_old[k] - pi[k])

        if verbose:
            print("[%d]%g" % (i, cutoff))

        if cutoff <= epsilon or lenNU == 1:
            break

    return initPi, pi, NU