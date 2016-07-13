def run(u, nu, genomes, verbose=False, max_iter=50, epsilon=1e-7, pi_prior=0, theta_prior=0):
    # Initial values
    theta = [1 / genomes.count] * genomes.count
    pi = list(theta)
    init_pi = list(pi)

    pi_sum_0 = [0] * genomes.count

    # weights for unique reads...
    u_weights = [u[i][1] for i in u]
    max_u_weights = 0
    u_total = 0

    if u_weights:
        max_u_weights = max(u_weights)
        u_total = sum(u_weights)

    # pi_sum_0/u_total would be the weighted proportions of unique reads assigned to each genome (weights are
    # alignment scores)
    for i in u:
        pi_sum_0[u[i][0]] += u[i][1]

    # weights for non-unique reads.
    nu_weights = [nu[i][3] for i in nu]
    max_nu_weights = 0
    nu_total = 0

    if nu_weights:
        max_nu_weights = max(nu_weights)
        nu_total = sum(nu_weights)

    priorWeight = max(max_u_weights, max_nu_weights)
    len_nu = len(nu) or 1

    # EM iterations
    for i in range(max_iter):
        pi_old = pi
        theta_sum = [0] * genomes.count

        # E Step (for each non-uniq read, j)
        for j in nu:
            z = nu[j]

            # A set of any genome mapping with j
            ind = z[0]

            # Get relevant pis for the read
            pi_tmp = [pi[k] for k in ind]

            # Get relevant thetas for the read
            theta_tmp = [theta[k] for k in ind]

            # Calculate non-normalized xs
            x_tmp = [pi_tmp[k] * theta_tmp[k] * z[1][k] for k in range(len(ind))]

            x_sum = sum(x_tmp)

            if x_sum == 0:
                # Avoiding dividing by 0 at all times
                x_norm = [0] * len(x_tmp)

            else:
                # Normalize new xs
                x_norm = [k / x_sum for k in x_tmp]

            # Update x in NU
            nu[j][2] = x_norm

            for k in range(len(ind)):
                # Keep weighted running tally for theta
                theta_sum[ind[k]] += x_norm[k] * nu[j][3]

        # M step
        # Calculate tally for pi
        pi_sum = [theta_sum[k] + pi_sum_0[k] for k in range(len(theta_sum))]

        pip = pi_prior * priorWeight

        # Update pi
        pi = [(k + pip) / (u_total + nu_total + pip * len(pi_sum)) for k in pi_sum]

        if i == 0:
            initPi = pi

        theta_p = theta_prior * priorWeight

        nu_total_div = nu_total

        if nu_total_div == 0:
            nu_total_div = 1

        theta = [(k + theta_p) / (nu_total_div + theta_p * len(theta_sum)) for k in theta_sum]

        cutoff = 0.0

        for k in range(len(pi)):
            cutoff += abs(pi_old[k] - pi[k])

        if verbose:
            print("[%d]%g" % (i, cutoff))

        if cutoff <= epsilon or len_nu == 1:
            break

    return init_pi, pi, nu